/**
 * Client-side rate limiting: a sliding window per bucket plus server feedback.
 *
 * Understands the headers official APIs send, e.g. the Lost Ark Open API:
 *   X-RateLimit-Limit: 100   X-RateLimit-Remaining: 0   X-RateLimit-Reset: 1668659557 (epoch s)
 * and the standard `Retry-After` (seconds or HTTP date) on 429/503.
 */

export interface RateLimitPolicy {
  /** Requests allowed per interval. */
  limit: number;
  intervalMs: number;
  /** Optional minimum spacing between consecutive requests (politeness for websites). */
  minIntervalMs?: number;
}

/** Default politeness for hosts without a documented limit: 1 request per second. */
export const DEFAULT_HOST_POLICY: RateLimitPolicy = {
  limit: 1,
  intervalMs: 1000,
  minIntervalMs: 1000,
};

/** Interprets X-RateLimit-Reset: epoch seconds/ms, delta seconds or an HTTP date. */
export function parseRateLimitReset(value: string | undefined, nowMs: number): number | null {
  if (value === undefined || value.trim() === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric > 1e12) return numeric;
    if (numeric > 1e9) return numeric * 1000;
    return nowMs + numeric * 1000;
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? date : null;
}

/** Interprets Retry-After as a delay in ms (seconds or HTTP date). */
export function parseRetryAfter(value: string | undefined, nowMs: number): number | null {
  if (value === undefined || value.trim() === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - nowMs) : null;
}

export class RateLimiter {
  private readonly starts: number[] = [];
  private blockedUntil = 0;
  /** Last limit reported by the server, if any (diagnostics). */
  serverLimit: number | null = null;

  constructor(
    private readonly policy: RateLimitPolicy,
    private readonly clock: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  /** Waits until a request may start; returns the total time waited. */
  async acquire(): Promise<number> {
    let waited = 0;
    for (;;) {
      const now = this.clock();
      let wait = 0;
      if (now < this.blockedUntil) wait = this.blockedUntil - now;
      while (this.starts.length > 0 && (this.starts[0] ?? 0) <= now - this.policy.intervalMs)
        this.starts.shift();
      if (wait === 0 && this.starts.length >= this.policy.limit) {
        wait = (this.starts[0] ?? now) + this.policy.intervalMs - now;
      }
      const last = this.starts[this.starts.length - 1];
      if (wait === 0 && this.policy.minIntervalMs !== undefined && last !== undefined) {
        wait = Math.max(0, last + this.policy.minIntervalMs - now);
      }
      if (wait <= 0) {
        this.starts.push(now);
        return waited;
      }
      await this.sleep(wait);
      waited += wait;
    }
  }

  block(untilMs: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, untilMs);
  }

  /** Applies server rate-limit feedback from a response. */
  observe(headers: Record<string, string>, status: number): void {
    const now = this.clock();
    const limit = Number(headers['x-ratelimit-limit']);
    if (Number.isFinite(limit) && limit > 0) this.serverLimit = limit;
    const remaining = Number(headers['x-ratelimit-remaining']);
    const reset = parseRateLimitReset(headers['x-ratelimit-reset'], now);
    if (headers['x-ratelimit-remaining'] !== undefined && remaining <= 0 && reset !== null)
      this.block(reset);
    if (status === 429 || status === 503) {
      const retryAfter = parseRetryAfter(headers['retry-after'], now);
      if (retryAfter !== null) this.block(now + retryAfter);
      else if (status === 429 && reset !== null) this.block(reset);
    }
  }
}

export class RateLimiterRegistry {
  private readonly limiters = new Map<string, RateLimiter>();

  constructor(
    private readonly clock: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  get(key: string, policy: RateLimitPolicy = DEFAULT_HOST_POLICY): RateLimiter {
    let limiter = this.limiters.get(key);
    if (!limiter) {
      limiter = new RateLimiter(policy, this.clock, this.sleep);
      this.limiters.set(key, limiter);
    }
    return limiter;
  }
}
