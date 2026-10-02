/**
 * Migration runner. Kept out of the package's main entry so the web bundle never references
 * the migrations folder.
 */
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Absolute path of the generated SQL migrations. */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Applies pending migrations using a dedicated single connection. */
export async function migratePostgres(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end({ timeout: 5 });
  }
}
