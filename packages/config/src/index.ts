import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export { EnvError, parseServerEnv, resolveDataSource, serverEnvSchema, type DataSourceKind, type ServerEnv } from './env';

/** Walks up from `start` to the directory containing pnpm-workspace.yaml. */
export function findWorkspaceRoot(start: string = process.cwd()): string | null {
  let current = start;
  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Loads `<workspace root>/.env` into process.env (existing variables win). No-op when the
 * file is absent — the project must run without any .env file.
 */
export function loadDotEnv(start: string = process.cwd()): string | null {
  const root = findWorkspaceRoot(start);
  if (!root) return null;
  const file = join(root, '.env');
  if (!existsSync(file)) return null;
  process.loadEnvFile(file);
  return file;
}
