import { join } from 'node:path';
import { createTestAdapterContext, TEST_ANCHOR } from '@gamepulse/collectors/testing';
import { defaultFixturesDir, getAdapterDefinition, ManualFileAdapter } from '@gamepulse/collectors';
import { PostgresContentStore } from '@gamepulse/database';
import { createTestDatabase, type TestDatabase } from '@gamepulse/database/testing';
import { makeCandidate, makeSource } from '@gamepulse/domain/testing';
import { noopLogger } from '@gamepulse/observability';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runIngestion } from './pipeline';
import { ingestFixtures, syncRegistry } from './seed';
import { ScriptedAdapter } from './testing';

describe(`ingestion → PostgreSQL (${process.env.TEST_DATABASE_URL ? 'server' : 'PGlite'})`, () => {
  let database: TestDatabase;
  let store: PostgresContentStore;
  const clock = () => TEST_ANCHOR;

  beforeAll(async () => {
    database = await createTestDatabase();
    store = new PostgresContentStore(database.db);
  });

  beforeEach(async () => {
    await database.reset();
    await syncRegistry(store, TEST_ANCHOR);
  });

  afterAll(async () => {
    await database.close();
  });

  it('ingests every fixture feed into PostgreSQL and re-runs idempotently', async () => {
    const context = createTestAdapterContext({ mode: 'fixture' });
    const first = await ingestFixtures({ store, context, logger: noopLogger, trigger: 'TEST' });
    expect(first.every((report) => report.status === 'SUCCEEDED')).toBe(true);
    const created = first.reduce((sum, report) => sum + report.counters.new, 0);
    const records = await store.listContent({});
    expect(records.length).toBe(created);
    expect(new Set(records.map((record) => record.gameId)).size).toBe(5);

    const second = await ingestFixtures({ store, context, logger: noopLogger, trigger: 'TEST' });
    expect(
      second.reduce((sum, report) => sum + report.counters.new + report.counters.updated, 0),
    ).toBe(0);
    expect((await store.listContent({})).length).toBe(created);

    const patch = await store.getContentBySlug('league-of-legends-patch-26-19');
    expect(
      patch?.detail.type === 'PATCH' && patch.detail.changes.map((change) => change.targetName),
    ).toEqual(['아리', '요네', '징크스', '몰락한 왕의 검', '랭크 게임']);
    const rules = await store.listResetRules(['lostark']);
    expect(rules.map((rule) => rule.id)).toEqual(['lostark-daily', 'lostark-weekly']);
  });

  it('allows only one concurrent run per adapter', async () => {
    const definition = getAdapterDefinition('genshin-fixture');
    const context = createTestAdapterContext({ mode: 'fixture' });
    const [a, b] = await Promise.all([
      runIngestion(
        definition!.create(context),
        { store, logger: noopLogger, clock },
        { trigger: 'TEST' },
      ),
      runIngestion(
        definition!.create(context),
        { store, logger: noopLogger, clock },
        { trigger: 'TEST' },
      ),
    ]);
    expect([a.status, b.status].sort()).toEqual(['SKIPPED_LOCKED', 'SUCCEEDED']);
  });

  it('keeps previous content when a source fails', async () => {
    const source = makeSource({
      id: 'genshin-official-it',
      type: 'OFFICIAL_WEB',
      isOfficial: true,
      collectorStatus: 'ENABLED',
    });
    await store.syncSources([source], TEST_ANCHOR.toISOString());
    const candidate = makeCandidate('EVENT', {
      isSynthetic: false,
      sourceKey: 'evt',
      startAt: '2026-10-01T00:00:00Z',
      endAt: '2026-10-20T00:00:00Z',
    });
    const adapter = new ScriptedAdapter(source, [
      { externalId: 'a', url: 'https://genshin.hoyoverse.com/a', candidates: [candidate] },
    ]);
    expect(
      (await runIngestion(adapter, { store, logger: noopLogger, clock }, { trigger: 'TEST' }))
        .counters.new,
    ).toBe(1);

    adapter.discoverError = new Error('timeout');
    const failed = await runIngestion(
      adapter,
      { store, logger: noopLogger, clock },
      { trigger: 'TEST' },
    );
    expect(failed.status).toBe('FAILED');
    expect(await store.listContent({ gameIds: ['genshin'] })).toHaveLength(1);
    const [latestRun] = await store.listRuns(1);
    expect(latestRun).toMatchObject({ status: 'FAILED', error: 'discover: timeout' });
  });

  it('ingests the manual example file with date-only precision', async () => {
    const file = join(defaultFixturesDir(), 'manual', 'lol-patch-schedule.json');
    const report = await runIngestion(
      new ManualFileAdapter('lol', file, clock),
      { store, logger: noopLogger, clock },
      { trigger: 'MANUAL' },
    );
    expect(report.status).toBe('SUCCEEDED');
    expect(report.counters.new).toBe(2);
    const patch = await store.getContentBySlug('league-of-legends-patch-26-20');
    expect(patch).toMatchObject({
      verification: 'MANUAL_VERIFIED',
      isSynthetic: false,
      startAt: '2026-10-07T07:00:00.000Z',
      timing: { precision: 'DATE', sourceTimezone: 'America/Los_Angeles' },
      source: {
        type: 'MANUAL',
        url: 'https://support.riotgames.com/en-us/league-of-legends/gameplay/patch-schedule-league-of-legends',
      },
    });
  });
});
