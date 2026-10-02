/**
 * Error-reporting abstraction compatible with Sentry's API surface. Development needs no DSN:
 * the default reporter writes structured log entries. In production, pass the `@sentry/node`
 * (or `@sentry/nextjs`) module to `createSentryErrorReporter` — no code changes elsewhere.
 */
import type { Logger } from './logger';
import { serializeError } from './logger';

export interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export type ReportLevel = 'info' | 'warning' | 'error';

export interface ErrorReporter {
  captureException(error: unknown, context?: ErrorContext): void;
  captureMessage(message: string, level?: ReportLevel, context?: ErrorContext): void;
  flush(timeoutMs?: number): Promise<boolean>;
}

/** The subset of the Sentry SDK used by GAMEPULSE. `import * as Sentry from '@sentry/node'` satisfies it. */
export interface SentryLike {
  captureException(error: unknown, captureContext?: ErrorContext): string;
  captureMessage(message: string, captureContext?: ErrorContext & { level?: ReportLevel }): string;
  flush(timeout?: number): PromiseLike<boolean>;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function createLoggingErrorReporter(logger: Logger): ErrorReporter {
  return {
    captureException: (error, context) =>
      logger.error(errorMessage(error), { error: serializeError(error), ...context }),
    captureMessage: (message, level = 'info', context) => {
      const fields = { ...context, reportLevel: level };
      if (level === 'error') logger.error(message, fields);
      else if (level === 'warning') logger.warn(message, fields);
      else logger.info(message, fields);
    },
    flush: () => Promise.resolve(true),
  };
}

export function createSentryErrorReporter(sentry: SentryLike, logger?: Logger): ErrorReporter {
  return {
    captureException: (error, context) => {
      sentry.captureException(error, context);
      logger?.error(errorMessage(error), { error: serializeError(error), ...context });
    },
    captureMessage: (message, level = 'info', context) => {
      sentry.captureMessage(message, { ...context, level });
    },
    flush: async (timeoutMs = 2000) => Boolean(await sentry.flush(timeoutMs)),
  };
}
