import { describe, expect, it, vi } from 'vitest';
import {
  createLoggingErrorReporter,
  createSentryErrorReporter,
  errorMessage,
  type SentryLike,
} from './errors';
import { createLogger, createMemoryLogger } from './logger';

describe('logger', () => {
  it('writes structured entries with child bindings and filters by level', () => {
    const entries: unknown[] = [];
    const logger = createLogger({
      level: 'info',
      sink: (entry) => entries.push(entry),
      clock: () => new Date('2026-10-02T00:00:00Z'),
    });
    const child = logger.child({ adapter: 'genshin-fixture', game: 'genshin', runId: 'r1' });
    child.debug('hidden');
    child.info('fetched', { sourceUrl: 'https://example.com', duration: 12, status: 200 });
    expect(entries).toEqual([
      {
        time: '2026-10-02T00:00:00.000Z',
        level: 'info',
        msg: 'fetched',
        adapter: 'genshin-fixture',
        game: 'genshin',
        runId: 'r1',
        sourceUrl: 'https://example.com',
        duration: 12,
        status: 200,
      },
    ]);
  });

  it('serializes errors and drops undefined fields', () => {
    const { logger, entries } = createMemoryLogger();
    logger.error('boom', {
      error: new Error('bad', { cause: new Error('root') }),
      skipped: undefined,
    });
    expect(entries[0]).toMatchObject({
      msg: 'boom',
      error: { name: 'Error', message: 'bad', cause: { message: 'root' } },
    });
    expect(entries[0]).not.toHaveProperty('skipped');
  });
});

describe('error reporters', () => {
  it('logs exceptions without a Sentry DSN', () => {
    const { logger, entries } = createMemoryLogger();
    createLoggingErrorReporter(logger).captureException(new Error('collector failed'), {
      tags: { adapter: 'x' },
    });
    expect(entries[0]).toMatchObject({
      level: 'error',
      msg: 'collector failed',
      tags: { adapter: 'x' },
    });
  });

  it('forwards to a Sentry-compatible client', async () => {
    const sentry: SentryLike = {
      captureException: vi.fn(() => 'id'),
      captureMessage: vi.fn(() => 'id'),
      flush: vi.fn(() => Promise.resolve(true)),
    };
    const reporter = createSentryErrorReporter(sentry);
    reporter.captureException('oops', { extra: { a: 1 } });
    reporter.captureMessage('note', 'warning');
    expect(sentry.captureException).toHaveBeenCalledWith('oops', { extra: { a: 1 } });
    expect(sentry.captureMessage).toHaveBeenCalledWith('note', { level: 'warning' });
    expect(await reporter.flush()).toBe(true);
  });

  it('extracts messages from unknown values', () => {
    expect(errorMessage(new Error('x'))).toBe('x');
    expect(errorMessage('y')).toBe('y');
    expect(errorMessage({ code: 1 })).toBe('{"code":1}');
  });
});
