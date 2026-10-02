/**
 * Process wiring shared by the worker and the CLI: environment, logger, error reporter and
 * content store (PostgreSQL, or in-memory for --dry-run).
 */
import { loadDotEnv, parseServerEnv, type ServerEnv } from '@gamepulse/config';
import { connectPostgres, InMemoryContentStore, PostgresContentStore } from '@gamepulse/database';
import type { ContentStore } from '@gamepulse/domain';
import {
  createLogger,
  createLoggingErrorReporter,
  type ErrorReporter,
  type Logger,
} from '@gamepulse/observability';

export interface Runtime {
  env: ServerEnv;
  logger: Logger;
  errorReporter: ErrorReporter;
  store: ContentStore;
  storeKind: 'postgres' | 'memory';
  close: () => Promise<void>;
}

export interface RuntimeOptions {
  /** Use an in-memory store (nothing is persisted). */
  dryRun?: boolean;
  /** Default log format; JSON in production. */
  logFormat?: 'json' | 'pretty';
}

export function loadEnvironment(): ServerEnv {
  loadDotEnv();
  return parseServerEnv(process.env);
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const env = loadEnvironment();
  const logger = createLogger({
    level: env.LOG_LEVEL,
    format:
      env.LOG_FORMAT ?? options.logFormat ?? (env.NODE_ENV === 'production' ? 'json' : 'pretty'),
    bindings: { service: 'worker' },
  });
  // Sentry-compatible: wire @sentry/node here when SENTRY_DSN is configured (docs/RUNBOOK.md).
  const errorReporter = createLoggingErrorReporter(logger);

  if (options.dryRun) {
    logger.warn('dry run: using an in-memory store, nothing will be persisted');
    return {
      env,
      logger,
      errorReporter,
      store: new InMemoryContentStore(),
      storeKind: 'memory',
      close: () => Promise.resolve(),
    };
  }
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Start services (pnpm services:up or pnpm services:local), copy .env.example to .env, or pass --dry-run.',
    );
  }
  const connection = connectPostgres(env.DATABASE_URL, { max: 5 });
  return {
    env,
    logger,
    errorReporter,
    store: new PostgresContentStore(connection.db),
    storeKind: 'postgres',
    close: () => connection.close(),
  };
}
