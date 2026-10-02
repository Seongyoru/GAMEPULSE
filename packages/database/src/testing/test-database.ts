/**
 * Test database factory.
 *
 *   TEST_DATABASE_URL set → a throwaway database is created on that server, migrated and
 *                           dropped afterwards (CI uses a PostgreSQL service container).
 *   otherwise             → embedded PGlite (real PostgreSQL compiled to WASM), in memory.
 *
 * Both paths run the same SQL migrations, so integration tests never need Docker.
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { connectPostgres, migratePostgres, MIGRATIONS_FOLDER, type Database } from '../client';
import * as schema from '../schema';

export interface TestDatabase {
  db: Database;
  kind: 'postgres' | 'pglite';
  /** Removes all rows from every table (keeps the schema). */
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

const TABLES = [
  'validation_results',
  'parse_results',
  'content_sources',
  'banner_featured',
  'banners',
  'patch_changes',
  'patches',
  'events',
  'reward_items',
  'rewards',
  'redeem_codes',
  'maintenances',
  'content_items',
  'raw_documents',
  'ingestion_runs',
  'game_entities',
  'localizations',
  'reset_rules',
  'sources',
  'games',
];

async function truncateAll(db: Database): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`));
}

async function createPostgresTestDatabase(adminUrl: string): Promise<TestDatabase> {
  const name = `gp_test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  await admin.end({ timeout: 5 });

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  await migratePostgres(url.toString());
  const connection = connectPostgres(url.toString(), { max: 4 });

  return {
    db: connection.db,
    kind: 'postgres',
    reset: () => truncateAll(connection.db),
    close: async () => {
      await connection.close();
      const cleanup = postgres(adminUrl, { max: 1, onnotice: () => undefined });
      await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await cleanup.end({ timeout: 5 });
    },
  };
}

async function createPgliteTestDatabase(): Promise<TestDatabase> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ]);
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db,
    kind: 'pglite',
    reset: () => truncateAll(db),
    close: () => client.close(),
  };
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = process.env.TEST_DATABASE_URL;
  return adminUrl ? createPostgresTestDatabase(adminUrl) : createPgliteTestDatabase();
}
