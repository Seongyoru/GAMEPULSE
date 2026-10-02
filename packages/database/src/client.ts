import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';

export type Schema = typeof schema;

/** Driver-agnostic Drizzle database (postgres-js in production, PGlite in tests). */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export interface PostgresConnection {
  db: Database;
  close: () => Promise<void>;
}

export interface PostgresConnectionOptions {
  /** Pool size. Web servers usually need few connections because pages are cached. */
  max?: number;
  /** Statement timeout in ms applied to every connection. */
  statementTimeoutMs?: number;
}

export function connectPostgres(
  url: string,
  options: PostgresConnectionOptions = {},
): PostgresConnection {
  const client = postgres(url, {
    max: options.max ?? 10,
    onnotice: () => undefined,
    connection: { statement_timeout: options.statementTimeoutMs ?? 15_000 },
  });
  const db = drizzle({ client, schema });
  return {
    db,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}
