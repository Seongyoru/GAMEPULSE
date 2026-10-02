/**
 * Polite HTTP client used by every live collector.
 *
 *  - identifies GAMEPULSE in the User-Agent (with a contact when configured)
 *  - per-bucket rate limiting + server feedback (X-RateLimit-*, Retry-After)
 *  - exponential backoff with full jitter for 429/5xx/network errors
 *  - conditional requests (ETag / Last-Modified) to avoid re-downloading unchanged documents
 *  - robots.txt enforcement for website collectors
 *  - anti-bot / challenge pages fail immediately: never retried, never bypassed
 */
import type { Logger } from '@gamepulse/observability';
import { RateLimiterRegistry, parseRetryAfter, type RateLimitPolicy } from './rate-limit';
import type { RobotsCache } from './robots';
import type { HttpResponse, HttpTransport } from './transport';

export class HttpError extends Error {
  override name = 'HttpError';
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export class RobotsDisallowedError extends Error {
  override name = 'RobotsDisallowedError';
  constructor(readonly url: string) {
    super(`robots.txt disallows fetching ${url}`);
  }
}

export class BlockedByProtectionError extends Error {
  override name = 'BlockedByProtectionError';
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(
      `Access to ${url} is protected by an anti-bot challenge (HTTP ${status}); collection stopped`,
    );
  }
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
};

/** "Full jitter" exponential backoff: uniform in [0, min(max, base·2^attempt)). */
export function backoffDelay(
  attempt: number,
  policy: RetryPolicy,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.floor(random() * ceiling);
}

export function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

const CHALLENGE_BODY =
  /captcha|cf-chl-|challenge-platform|attention required|access denied by security policy/i;

export function looksLikeProtectionChallenge(response: HttpResponse): boolean {
  if (response.status !== 403 && response.status !== 429 && response.status !== 503) return false;
  if (response.headers['cf-mitigated'] === 'challenge') return true;
  return CHALLENGE_BODY.test(response.body.slice(0, 5000));
}

export interface HttpClientOptions {
  transport: HttpTransport;
  userAgent: string;
  logger: Logger;
  robots?: RobotsCache | null;
  retry?: RetryPolicy;
  timeoutMs?: number;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  /** Rate-limit bucket; defaults to the URL host. */
  rateLimitKey?: string;
  rateLimit?: RateLimitPolicy;
  /** Check robots.txt first (mandatory for website collectors). */
  respectRobots?: boolean;
  conditional?: { etag: string | null; lastModified: string | null } | null;
  /** Statuses returned to the caller instead of raising (e.g. 404 for optional resources). */
  acceptStatuses?: readonly number[];
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  private readonly limiters: RateLimiterRegistry;
  private readonly retry: RetryPolicy;
  private readonly clock: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(private readonly options: HttpClientOptions) {
    this.retry = options.retry ?? DEFAULT_RETRY_POLICY;
    this.clock = options.clock ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.limiters = new RateLimiterRegistry(this.clock, this.sleep);
  }

  get userAgent(): string {
    return this.options.userAgent;
  }

  async get(url: string, request: RequestOptions = {}): Promise<HttpResponse> {
    if (request.respectRobots) {
      if (!this.options.robots)
        throw new Error('respectRobots requested but no RobotsCache configured');
      if (!(await this.options.robots.isAllowed(url, this.options.userAgent)))
        throw new RobotsDisallowedError(url);
    }

    const limiter = this.limiters.get(request.rateLimitKey ?? new URL(url).host, request.rateLimit);
    const headers: Record<string, string> = {
      'user-agent': this.options.userAgent,
      accept: 'application/json, text/html;q=0.9, */*;q=0.8',
      ...(request.conditional?.etag ? { 'if-none-match': request.conditional.etag } : {}),
      ...(request.conditional?.lastModified
        ? { 'if-modified-since': request.conditional.lastModified }
        : {}),
      ...request.headers,
    };
    const accepted = new Set(request.acceptStatuses ?? []);

    for (let attempt = 0; ; attempt += 1) {
      await limiter.acquire();
      const started = this.clock();
      let response: HttpResponse;
      try {
        response = await this.options.transport.send({
          url,
          method: 'GET',
          headers,
          timeoutMs: this.options.timeoutMs ?? 20_000,
        });
      } catch (error) {
        if (attempt < this.retry.maxRetries) {
          const delay = backoffDelay(attempt, this.retry, this.random);
          this.options.logger.warn('http network error, retrying', { url, attempt, delay, error });
          await this.sleep(delay);
          continue;
        }
        throw new HttpError(`Network error fetching ${url}`, null, url, { cause: error });
      }

      limiter.observe(response.headers, response.status);
      this.options.logger.debug('http response', {
        url,
        status: response.status,
        duration: this.clock() - started,
        attempt,
        rateLimitRemaining: response.headers['x-ratelimit-remaining'],
      });

      if (looksLikeProtectionChallenge(response))
        throw new BlockedByProtectionError(url, response.status);
      if (
        (response.status >= 200 && response.status < 300) ||
        response.status === 304 ||
        accepted.has(response.status)
      ) {
        return response;
      }
      if (isRetryableStatus(response.status) && attempt < this.retry.maxRetries) {
        const retryAfter = parseRetryAfter(response.headers['retry-after'], this.clock()) ?? 0;
        const delay = Math.min(
          this.retry.maxDelayMs * 4,
          Math.max(retryAfter, backoffDelay(attempt, this.retry, this.random)),
        );
        this.options.logger.warn('http retryable status', {
          url,
          status: response.status,
          attempt,
          delay,
        });
        await this.sleep(delay);
        continue;
      }
      throw new HttpError(`HTTP ${response.status} for ${url}`, response.status, url);
    }
  }

  async getJson<T = unknown>(
    url: string,
    request: RequestOptions = {},
  ): Promise<{ response: HttpResponse; data: T }> {
    const response = await this.get(url, request);
    try {
      return { response, data: JSON.parse(response.body) as T };
    } catch (error) {
      throw new HttpError(`Invalid JSON from ${url}`, response.status, url, { cause: error });
    }
  }
}
