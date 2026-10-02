/**
 * Process wiring shared by the worker and the CLI: environment, logger, error reporter and
 * content store (PostgreSQL, or in-memory for --dry-run).
 */
import { loadDotEnv, parseServerEnv, type ServerEnv } from '@gamepulse/config';
import { connectPostgres, InMemoryContentStore, PostgresContentStore } from '@gamepulse/database';
import type { ContentStore } from '@gamepulse/domain';
import type { AIParser } from '@gamepulse/parsers';
import {
  createLogger,
  createLoggingErrorReporter,
  type ErrorReporter,
  type Logger,
} from '@gamepulse/observability';
import { createParser } from './parser';

export interface Runtime {
  env: ServerEnv;
  logger: Logger;
  errorReporter: ErrorReporter;
  store: ContentStore;
  storeKind: 'postgres' | 'memory';
  /** Parser for adapters that read unstructured text (AI_PARSER), with a store-backed cache. */
  parser: () => AIParser;
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

  // Created on first use: commands that never parse text work without AI configuration.
  const lazyParser = (store: ContentStore) => {
    let parser: AIParser | null = null;
    return () => (parser ??= createParser(env, store));
  };

  if (options.dryRun) {
    logger.warn('dry run: using an in-memory store, nothing will be persisted');
    const store = new InMemoryContentStore();
    return {
      env,
      logger,
      errorReporter,
      store,
      storeKind: 'memory',
      parser: lazyParser(store),
      close: () => Promise.resolve(),
    };
  }
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Start services (pnpm services:up or pnpm services:local), copy .env.example to .env, or pass --dry-run.',
    );
  }
  const connection = connectPostgres(env.DATABASE_URL, { max: 5 });
  const store = new PostgresContentStore(connection.db);
  return {
    env,
    logger,
    errorReporter,
    store,
    storeKind: 'postgres',
    parser: lazyParser(store),
    close: () => connection.close(),
  };
}
