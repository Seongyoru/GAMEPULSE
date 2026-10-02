import { noopLogger } from '@gamepulse/observability';
import { describe, expect, it } from 'vitest';
import {
  backoffDelay,
  BlockedByProtectionError,
  HttpClient,
  HttpError,
  RobotsDisallowedError,
  type HttpClientOptions,
} from './client';
import { parseRateLimitReset, parseRetryAfter, RateLimiter } from './rate-limit';
import { isPathAllowed, parseRobotsTxt, RobotsCache } from './robots';
import { MockTransport } from './transport';

/** Virtual clock: sleeping advances time instantly. */
function virtualTime(start = Date.parse('2026-10-02T00:00:00Z')) {
  let now = start;
  const sleeps: number[] = [];
  return {
    clock: () => now,
    sleep: (ms: number) => {
      sleeps.push(ms);
      now += ms;
      return Promise.resolve();
    },
    sleeps,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function client(transport: MockTransport, overrides: Partial<HttpClientOptions> = {}) {
  const time = virtualTime();
  const http = new HttpClient({
    transport,
    userAgent: 'GAMEPULSE-Collector/0.1 (+https://example.com/contact)',
    logger: noopLogger,
    clock: time.clock,
    sleep: time.sleep,
    random: () => 0.5,
    ...overrides,
  });
  return { http, time };
}

describe('backoffDelay', () => {
  it('grows exponentially with full jitter and a ceiling', () => {
    const policy = { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 1000 };
    expect(backoffDelay(0, policy, () => 0.5)).toBe(50);
    expect(backoffDelay(3, policy, () => 0.5)).toBe(400);
    expect(backoffDelay(10, policy, () => 0.999)).toBe(999);
    expect(backoffDelay(2, policy, () => 0)).toBe(0);
  });
});

describe('rate-limit header parsing', () => {
  const now = Date.parse('2026-10-02T00:00:00Z');
  it('understands epoch seconds, deltas and HTTP dates', () => {
    expect(parseRateLimitReset('1790000000', now)).toBe(1_790_000_000_000);
    expect(parseRateLimitReset('30', now)).toBe(now + 30_000);
    expect(parseRateLimitReset('Fri, 02 Oct 2026 00:01:00 GMT', now)).toBe(now + 60_000);
    expect(parseRetryAfter('2', now)).toBe(2000);
    expect(parseRetryAfter(undefined, now)).toBeNull();
  });
});

describe('RateLimiter', () => {
  it('enforces the window and server-reported exhaustion', async () => {
    const time = virtualTime();
    const limiter = new RateLimiter({ limit: 2, intervalMs: 60_000 }, time.clock, time.sleep);
    await limiter.acquire();
    await limiter.acquire();
    expect(await limiter.acquire()).toBe(60_000);

    limiter.observe(
      { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String((time.clock() + 5000) / 1000) },
      200,
    );
    expect(await limiter.acquire()).toBe(5000);
  });
});

describe('HttpClient', () => {
  it('sends an identifying User-Agent and conditional headers', async () => {
    const transport = new MockTransport().on('https://api.example.com/a', { status: 304 });
    const { http } = client(transport);
    const response = await http.get('https://api.example.com/a', {
      conditional: { etag: '"v1"', lastModified: null },
    });
    expect(response.status).toBe(304);
    expect(transport.requests[0]?.headers).toMatchObject({
      'user-agent': 'GAMEPULSE-Collector/0.1 (+https://example.com/contact)',
      'if-none-match': '"v1"',
    });
  });

  it('retries 429 honouring Retry-After, then succeeds', async () => {
    const transport = new MockTransport().on(
      'https://api.example.com/limited',
      { status: 429, headers: { 'Retry-After': '3' } },
      { status: 200, body: { ok: true } },
    );
    const { http, time } = client(transport);
    const { data } = await http.getJson<{ ok: boolean }>('https://api.example.com/limited', {
      rateLimit: { limit: 100, intervalMs: 60_000 },
    });
    expect(data.ok).toBe(true);
    expect(transport.requests).toHaveLength(2);
    expect(time.sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(3000);
  });

  it('retries network errors with backoff and eventually gives up', async () => {
    const transport = new MockTransport().on('https://api.example.com/down', {
      networkError: 'ECONNRESET',
    });
    const { http } = client(transport, {
      retry: { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    await expect(
      http.get('https://api.example.com/down', { rateLimit: { limit: 100, intervalMs: 1000 } }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(transport.requests).toHaveLength(3);
  });

  it('does not retry client errors and returns accepted statuses', async () => {
    const transport = new MockTransport().on('https://api.example.com/missing', { status: 404 });
    const { http } = client(transport);
    await expect(http.get('https://api.example.com/missing')).rejects.toMatchObject({
      status: 404,
    });
    expect(
      (await http.get('https://api.example.com/missing', { acceptStatuses: [404] })).status,
    ).toBe(404);
  });

  it('stops immediately at anti-bot challenges', async () => {
    const transport = new MockTransport().on('https://site.example.com/news', {
      status: 403,
      headers: { 'cf-mitigated': 'challenge' },
      body: '<html>Just a moment</html>',
    });
    const { http } = client(transport);
    await expect(http.get('https://site.example.com/news')).rejects.toBeInstanceOf(
      BlockedByProtectionError,
    );
    expect(transport.requests).toHaveLength(1);
  });

  it('enforces robots.txt for website collectors', async () => {
    const transport = new MockTransport()
      .on('https://site.example.com/robots.txt', { body: 'User-agent: *\nDisallow: /private\n' })
      .on('https://site.example.com/news', { body: 'ok' });
    const { http } = client(transport, { robots: new RobotsCache(transport) });
    expect((await http.get('https://site.example.com/news', { respectRobots: true })).body).toBe(
      'ok',
    );
    await expect(
      http.get('https://site.example.com/private/x', { respectRobots: true }),
    ).rejects.toBeInstanceOf(RobotsDisallowedError);
  });
});

describe('robots.txt', () => {
  const rules = parseRobotsTxt(
    [
      '\uFEFFUser-agent: *',
      'Disallow: /guide',
      'Allow: /Guide/N23GameInformation',
      'Disallow: /*.pdf$',
      '',
      'User-agent: GAMEPULSE-Collector',
      'Disallow: /beta',
    ].join('\n'),
  );

  it('applies the most specific group and the longest matching rule', () => {
    const ua = 'GAMEPULSE-Collector/0.1';
    expect(isPathAllowed(rules, ua, '/beta/x')).toBe(false);
    expect(isPathAllowed(rules, ua, '/guide/x')).toBe(true); // specific group has no /guide rule
    expect(isPathAllowed(rules, 'OtherBot/1.0', '/guide/x')).toBe(false);
    expect(isPathAllowed(rules, 'OtherBot/1.0', '/Guide/N23GameInformation/1')).toBe(true);
    expect(isPathAllowed(rules, 'OtherBot/1.0', '/files/a.pdf')).toBe(false);
    expect(isPathAllowed(rules, 'OtherBot/1.0', '/News')).toBe(true);
  });

  it('treats missing robots.txt as allow and server errors as disallow', async () => {
    const transport = new MockTransport()
      .on('https://a.example.com/robots.txt', { status: 404 })
      .on('https://b.example.com/robots.txt', { status: 503 });
    const cache = new RobotsCache(transport);
    expect(await cache.isAllowed('https://a.example.com/x', 'Bot/1')).toBe(true);
    expect(await cache.isAllowed('https://b.example.com/x', 'Bot/1')).toBe(false);
  });
});
