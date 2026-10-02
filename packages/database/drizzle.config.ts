import { defineConfig } from 'drizzle-kit';

/** Migration generation needs no database; `pnpm db:migrate` applies them using DATABASE_URL. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://gamepulse:gamepulse@localhost:5432/gamepulse',
  },
});
