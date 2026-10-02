import 'server-only';
import { createAdapterContext, defaultFixtureAnchor } from '@gamepulse/collectors';
import { connectPostgres, InMemoryContentStore, PostgresContentStore } from '@gamepulse/database';
import type { ContentReadStore } from '@gamepulse/domain';
import { ingestFixtures, syncRegistry } from '@gamepulse/ingestion';
import { createLogger } from '@gamepulse/observability';
import { dataSourceKind, serverEnv } from './env';

let databaseStore: ContentReadStore | null = null;
let fixtureStore: { anchorMs: number; store: Promise<ContentReadStore> } | null = null;

/**
 * Fixture mode: run every fixture feed through the real ingestion pipeline into memory.
 * Rebuilt when the anchor hour changes so long-running dev servers stay "current".
 */
async function buildFixtureStore(anchor: Date): Promise<ContentReadStore> {
  const env = serverEnv();
  const logger = createLogger({ level: 'warn', format: 'pretty', bindings: { service: 'web' } });
  const store = new InMemoryContentStore();
  await syncRegistry(store, anchor);
  const context = createAdapterContext({
    mode: 'fixture',
    env,
    logger,
    fixtureAnchor: anchor,
    clock: () => anchor,
  });
  const reports = await ingestFixtures({ store, context, logger, trigger: 'WEB_FIXTURES' });
  const failed = reports.filter((report) => report.status !== 'SUCCEEDED');
  if (failed.length > 0)
    logger.warn('fixture ingestion incomplete', { adapters: failed.map((r) => r.adapterId) });
  return store;
}

export function getReadStore(): Promise<ContentReadStore> {
  const env = serverEnv();
  if (dataSourceKind() === 'database') {
    databaseStore ??= new PostgresContentStore(
      connectPostgres(env.DATABASE_URL ?? '', { max: 5, statementTimeoutMs: 10_000 }).db,
    );
    return Promise.resolve(databaseStore);
  }
  const anchor = env.FIXTURE_ANCHOR
    ? new Date(env.FIXTURE_ANCHOR)
    : defaultFixtureAnchor(new Date());
  if (!fixtureStore || fixtureStore.anchorMs !== anchor.getTime()) {
    fixtureStore = { anchorMs: anchor.getTime(), store: buildFixtureStore(anchor) };
  }
  return fixtureStore.store;
}
