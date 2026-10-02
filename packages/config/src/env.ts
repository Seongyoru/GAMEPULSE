/**
 * Server-side environment schema. Never import this module from client components:
 * it describes secrets (API keys, database credentials) that must stay on the server.
 *
 * Every variable is optional for local development — the project runs on fixtures
 * without any external service or credential.
 */
import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const booleanFlag = (fallback: boolean) =>
  z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (normalized === undefined) return fallback;
    if (typeof normalized === 'string')
      return ['1', 'true', 'yes', 'on'].includes(normalized.toLowerCase());
    return normalized;
  }, z.boolean());

export const serverEnvSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(['development', 'test', 'production']).default('development'),
  ),
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ),
  LOG_FORMAT: z.preprocess(emptyToUndefined, z.enum(['json', 'pretty']).optional()),

  DATABASE_URL: optionalUrl,
  REDIS_URL: optionalUrl,

  /** Where the web app reads content from. Defaults: database when DATABASE_URL is set, else fixtures. */
  GAMEPULSE_DATA_SOURCE: z.preprocess(
    emptyToUndefined,
    z.enum(['fixtures', 'database']).optional(),
  ),
  /** Public base URL used for canonical links and sitemaps. No production domain is hardcoded. */
  GAMEPULSE_SITE_URL: z.preprocess(emptyToUndefined, z.url().default('http://localhost:3000')),
  /** Fixtures in production are refused unless explicitly allowed (e.g. a staging preview). */
  GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION: booleanFlag(false),
  /** Fixed anchor for relative fixture dates (ISO). Defaults to the current hour. */
  FIXTURE_ANCHOR: z.preprocess(emptyToUndefined, z.iso.datetime({ offset: true }).optional()),

  COLLECTOR_MODE: z.preprocess(
    emptyToUndefined,
    z.enum(['fixture', 'mock', 'live']).default('fixture'),
  ),
  COLLECTOR_USER_AGENT: z.preprocess(
    emptyToUndefined,
    z.string().default('GAMEPULSE-Collector/0.1'),
  ),
  /** Contact URL or e-mail appended to the collector User-Agent so site owners can reach us. */
  COLLECTOR_CONTACT: optionalString,
  INGEST_SCHEDULE_ENABLED: booleanFlag(true),
  RAW_TEXT_RETENTION_DAYS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(3650).default(30),
  ),

  RIOT_API_KEY: optionalString,
  LOSTARK_API_KEY: optionalString,
  NEXON_OPEN_API_KEY: optionalString,

  AI_PARSER: z.preprocess(
    emptyToUndefined,
    z.enum(['mock', 'rule-based', 'claude']).default('rule-based'),
  ),
  ANTHROPIC_API_KEY: optionalString,
  AI_MODEL: z.preprocess(emptyToUndefined, z.string().default('claude-sonnet-5-5')),

  SENTRY_DSN: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvError extends Error {
  override name = 'EnvError';
}

/** Parses and validates the server environment, reporting every invalid variable at once. */
export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new EnvError(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

export type DataSourceKind = 'fixtures' | 'database';

/**
 * Synthetic fixtures (and mock-mode recordings) may be served or ingested outside production,
 * or in a production build that explicitly opts in (staging previews, CI builds).
 */
export function fixturesAllowed(env: ServerEnv): boolean {
  return env.NODE_ENV !== 'production' || env.GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION;
}

/** Resolves which content backend the web app should use. */
export function resolveDataSource(env: ServerEnv): DataSourceKind {
  const kind = env.GAMEPULSE_DATA_SOURCE ?? (env.DATABASE_URL ? 'database' : 'fixtures');
  if (kind === 'database' && !env.DATABASE_URL) {
    throw new EnvError('GAMEPULSE_DATA_SOURCE=database requires DATABASE_URL');
  }
  if (kind === 'fixtures' && !fixturesAllowed(env)) {
    throw new EnvError(
      'Refusing to serve synthetic fixtures in production. Set DATABASE_URL, or GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION=true for previews.',
    );
  }
  return kind;
}
