/**
 * Applies pending SQL migrations: `pnpm db:migrate` (reads DATABASE_URL, loading .env if present).
 */
import { loadDotEnv } from '@gamepulse/config';
import { migratePostgres } from '../migrations';

loadDotEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env or export DATABASE_URL.');
  process.exit(1);
}

const started = Date.now();
try {
  await migratePostgres(url);
  console.log(`Migrations applied in ${Date.now() - started} ms`);
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
