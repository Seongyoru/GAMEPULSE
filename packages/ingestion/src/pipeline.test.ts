import { createTestAdapterContext, TEST_ANCHOR } from '@gamepulse/collectors/testing';
import { getAdapterDefinition, manualSourceFor } from '@gamepulse/collectors';
import { InMemoryContentStore } from '@gamepulse/database/memory';
import { requireGame, type ContentStore } from '@gamepulse/domain';
import { makeCandidate, makeSource } from '@gamepulse/domain/testing';
import { createMemoryLogger, noopLogger } from '@gamepulse/observability';
import { beforeEach, describe, expect, it } from 'vitest';
import { runIngestion } from './pipeline';
import { ingestFixtures, syncRegistry } from './seed';
import { ScriptedAdapter } from './testing';

const clock = () => TEST_ANCHOR;
const deps = (store: ContentStore) => ({ store, logger: noopLogger, clock });

const officialSource = makeSource({
  id: 'genshin-official-test',
  name: '원신 공식',
  type: 'OFFICIAL_WEB',
  isOfficial: true,
  collectorStatus: 'ENABLED',
});
const manualSource = manualSourceFor(requireGame('genshin'));
const fixtureSource = makeSource({ id: 'genshin-fixture' });

describe('fixture ingestion', () => {
  let store: InMemoryContentStore;

  beforeEach(async () => {
    store = new InMemoryContentStore();
    await syncRegistry(store, TEST_ANCHOR);
  });

  it('ingests all five games and is idempotent on re-run', async () => {
    const context = createTestAdapterContext({ mode: 'fixture' });
    const first = await ingestFixtures({ store, context, logger: noopLogger, trigger: 'TEST' });
    expect(first.map((r) => r.gameId)).toEqual(['lol', 'lostark', 'maplestory', 'genshin', 'wuwa']);
    for (const report of first) {
      expect(report.status, report.adapterId).toBe('SUCCEEDED');
      expect(report.warnings, report.adapterId).toEqual([]);
      expect(report.counters.failed, report.adapterId).toBe(0);
      expect(report.counters.new, report.adapterId).toBeGreaterThan(0);
    }
    const total = (await store.listContent({})).length;

    const second = await ingestFixtures({ store, context, logger: noopLogger, trigger: 'TEST' });
    for (const report of second) {
      expect(report.counters.new, report.adapterId).toBe(0);
      expect(report.counters.updated, report.adapterId).toBe(0);
      expect(report.counters.unchanged, report.adapterId).toBe(report.counters.discovered);
      expect(report.counters.fetched, report.adapterId).toBe(report.counters.discovered);
    }
    expect((await store.listContent({})).length).toBe(total);
  });

  it('meets the fixture minimums from the product spec', async () => {
    const context = createTestAdapterContext({ mode: 'fixture' });
    await ingestFixtures({ store, context, logger: noopLogger, trigger: 'TEST' });
    const all = await store.listContent({});
    const count = (type: string) => all.filter((r) => r.type === type).length;
    expect(new Set(all.map((r) => r.gameId)).size).toBe(5);
    expect(count('PATCH')).toBeGreaterThanOrEqual(3);
    expect(count('EVENT')).toBeGreaterThanOrEqual(10);
    expect(count('REWARD')).toBeGreaterThanOrEqual(10);
    expect(count('MAINTENANCE')).toBeGreaterThanOrEqual(3);
    expect(count('BANNER')).toBeGreaterThanOrEqual(5);
    expect(count('REDEEM_CODE')).toBeGreaterThanOrEqual(3);
    expect((await store.listResetRules()).length).toBeGreaterThanOrEqual(5);
    expect(all.every((record) => record.isSynthetic)).toBe(true);
    const codes = all.filter((r) => r.detail.type === 'REDEEM_CODE');
    expect(
      codes.every((r) => r.detail.type === 'REDEEM_CODE' && r.detail.code.startsWith('GPTEST-')),
    ).toBe(true);
  });

  it('updates (never duplicates) content when the fixture anchor moves', async () => {
    await ingestFixtures({
      store,
      context: createTestAdapterContext({ mode: 'fixture' }),
      logger: noopLogger,
      trigger: 'TEST',
      gameIds: ['genshin'],
    });
    const before = await store.listContent({ gameIds: ['genshin'] });
    const nextDay = new Date(TEST_ANCHOR.getTime() + 86_400_000);
    const reports = await ingestFixtures({
      store,
      context: createTestAdapterContext({ mode: 'fixture', anchor: nextDay, now: nextDay }),
      logger: noopLogger,
      trigger: 'TEST',
      gameIds: ['genshin'],
    });
    expect(reports[0]?.counters.new).toBe(0);
    expect(reports[0]?.counters.updated).toBeGreaterThan(0);
    const after = await store.listContent({ gameIds: ['genshin'] });
    expect(after.map((r) => r.id).sort()).toEqual(before.map((r) => r.id).sort());
    const lantern = after.find((r) => r.slug === 'genshin-impact-banner-starlight-song-wish');
    const lanternBefore = before.find(
      (r) => r.slug === 'genshin-impact-banner-starlight-song-wish',
    );
    expect(Date.parse(lantern?.startAt ?? '') - Date.parse(lanternBefore?.startAt ?? '')).toBe(
      86_400_000,
    );
  });

  it('preserves original server-time text alongside normalized UTC', async () => {
    await ingestFixtures({
      store,
      context: createTestAdapterContext({ mode: 'fixture' }),
      logger: noopLogger,
      trigger: 'TEST',
      gameIds: ['wuwa'],
    });
    const banner = await store.getContentBySlug('wuthering-waves-banner-tidecaller-convene');
    expect(banner?.timing).toMatchObject({
      sourceTimezone: 'UTC+8',
      region: 'asia',
      precision: 'DATETIME',
    });
    expect(banner?.timing?.endAtSource).toMatch(/^\d{4}\/\d{2}\/\d{2} 09:59 \(UTC\+8\)$/);
    expect(new Date(banner?.endAt ?? '').getUTCHours()).toBe(1); // 09:59 UTC+8 = 01:59 UTC
  });
});

describe('pipeline guarantees', () => {
  let store: InMemoryContentStore;

  beforeEach(async () => {
    store = new InMemoryContentStore();
    await syncRegistry(store, TEST_ANCHOR);
    await store.syncSources([officialSource, fixtureSource], TEST_ANCHOR.toISOString());
  });

  const event = (overrides = {}) =>
    makeCandidate('EVENT', {
      isSynthetic: false,
      sourceKey: 'evt-1',
      title: '공식 이벤트',
      startAt: '2026-10-01T02:00:00Z',
      endAt: '2026-10-20T02:00:00Z',
      ...overrides,
    });

  it('prevents concurrent runs of the same adapter', async () => {
    const adapter = new ScriptedAdapter(officialSource, [
      { externalId: 'a', url: 'https://genshin.hoyoverse.com/a', candidates: [event()] },
    ]);
    await store.startRun({
      adapterId: adapter.id,
      sourceId: officialSource.id,
      gameId: 'genshin',
      trigger: 'TEST',
      mode: 'mock',
      now: TEST_ANCHOR.toISOString(),
      staleAfterMs: 3_600_000,
    });
    const report = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(report.status).toBe('SKIPPED_LOCKED');
    expect(adapter.fetchCalls).toBe(0);
  });

  it('skips unchanged documents without re-parsing', async () => {
    const adapter = new ScriptedAdapter(officialSource, [
      { externalId: 'a', url: 'https://genshin.hoyoverse.com/a', candidates: [event()] },
    ]);
    await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    const again = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(adapter.normalizeCalls).toBe(1);
    expect(again.counters).toMatchObject({ discovered: 1, fetched: 1, unchanged: 1, new: 0 });
    const forced = await runIngestion(adapter, deps(store), { trigger: 'TEST', force: true });
    expect(adapter.normalizeCalls).toBe(2);
    expect(forced.counters).toMatchObject({ new: 0, updated: 0, unchanged: 1 });
  });

  it('isolates failing documents and never deletes previous content', async () => {
    const adapter = new ScriptedAdapter(officialSource, [
      { externalId: 'a', url: 'https://genshin.hoyoverse.com/a', candidates: [event()] },
      {
        externalId: 'b',
        url: 'https://genshin.hoyoverse.com/b',
        candidates: [event({ sourceKey: 'evt-2', title: '두 번째' })],
      },
    ]);
    await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(await store.listContent({})).toHaveLength(2);

    adapter.documents[1] = {
      ...adapter.documents[1]!,
      rawText: 'changed',
      fetchError: new Error('HTTP 503'),
    };
    const { logger, entries } = createMemoryLogger();
    const partial = await runIngestion(adapter, { store, logger, clock }, { trigger: 'TEST' });
    expect(partial.status).toBe('PARTIAL');
    expect(partial.errors).toEqual([
      { stage: 'fetch', url: 'https://genshin.hoyoverse.com/b', message: 'HTTP 503' },
    ]);
    expect(await store.listContent({})).toHaveLength(2);
    const failure = entries.find((entry) => entry.msg === 'document failed');
    expect(failure).toMatchObject({
      adapter: officialSource.id,
      game: 'genshin',
      sourceUrl: 'https://genshin.hoyoverse.com/b',
      status: 'FAILED',
    });
    expect(failure).toHaveProperty('runId');
    expect(failure).toHaveProperty('duration');

    adapter.discoverError = new Error('source unreachable');
    const failed = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(failed.status).toBe('FAILED');
    expect(await store.listContent({})).toHaveLength(2);
    const runs = await store.listRuns(10);
    expect(runs.map((run) => run.status)).toEqual(
      expect.arrayContaining(['SUCCEEDED', 'PARTIAL', 'FAILED']),
    );
  });

  it('rejects invalid candidates and records validation results', async () => {
    const adapter = new ScriptedAdapter(officialSource, [
      {
        externalId: 'bad',
        url: 'https://genshin.hoyoverse.com/bad',
        candidates: [event({ startAt: '2026-10-20T00:00:00Z', endAt: '2026-10-01T00:00:00Z' })],
      },
    ]);
    const report = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(report.outcomes.rejected).toBe(1);
    expect(report.validation.INVALID).toBe(1);
    expect(await store.listContent({})).toHaveLength(0);
    expect(store.getValidationResults()[0]?.issues.map((issue) => issue.code)).toContain(
      'END_BEFORE_START',
    );
  });

  it('lets stronger sources supersede weaker ones and keeps provenance', async () => {
    const manualFact = event({ sourceKey: 'manual-1', title: '[이벤트] 별빛 축제' });
    await runIngestion(
      new ScriptedAdapter(
        manualSource,
        [{ externalId: 'm', url: 'file://manual.json', candidates: [manualFact] }],
        {
          id: 'manual-json',
          version: '1',
          kind: 'manual',
        },
      ),
      deps(store),
      { trigger: 'TEST' },
    );
    const [manualRecord] = await store.listContent({});
    expect(manualRecord?.verification).toBe('MANUAL_VERIFIED');

    const officialFact = event({ sourceKey: 'notice-77', title: '별빛 축제' });
    const official = await runIngestion(
      new ScriptedAdapter(officialSource, [
        { externalId: 'o', url: 'https://genshin.hoyoverse.com/o', candidates: [officialFact] },
      ]),
      deps(store),
      { trigger: 'TEST' },
    );
    expect(official.counters.updated).toBe(1);
    const records = await store.listContent({});
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: manualRecord?.id,
      slug: manualRecord?.slug,
      verification: 'AUTO_VERIFIED',
    });
    expect(records[0]?.provenance.map((p) => [p.sourceId, p.role])).toEqual([
      [officialSource.id, 'PRIMARY'],
      [manualSource.id, 'SUPPORTING'],
    ]);

    // The weaker source reporting again does not overwrite the official record.
    const manualAgain = await runIngestion(
      new ScriptedAdapter(
        manualSource,
        [
          {
            externalId: 'm',
            url: 'file://manual.json',
            rawText: 'v2',
            candidates: [{ ...manualFact, title: '별빛 축제 (수정 전 정보)' }],
          },
        ],
        {
          id: 'manual-json',
          version: '1',
          kind: 'manual',
        },
      ),
      deps(store),
      { trigger: 'TEST' },
    );
    expect(manualAgain.outcomes.duplicate).toBe(1);
    expect((await store.listContent({}))[0]?.title).toBe('별빛 축제');
  });

  it('keeps published content when a later update needs review', async () => {
    const adapter = new ScriptedAdapter(officialSource, [
      { externalId: 'a', url: 'https://genshin.hoyoverse.com/a', candidates: [event()] },
    ]);
    await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    adapter.documents[0] = {
      externalId: 'a',
      url: 'https://genshin.hoyoverse.com/a',
      candidates: [event({ endAt: '2028-12-31T00:00:00Z' })],
    };
    const report = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(report.outcomes['review-held']).toBe(1);
    const [record] = await store.listContent({});
    expect(record?.endAt).toBe('2026-10-20T02:00:00.000Z');
    expect(record?.status).toBe('PUBLISHED');
  });

  it('holds AI output without evidence for review (parser → validator)', async () => {
    const adapter = new ScriptedAdapter(
      officialSource,
      [
        {
          externalId: 'ai',
          url: 'https://genshin.hoyoverse.com/ai',
          candidates: [event({ sourceKey: 'ai-1', confidence: 0.97 })],
        },
      ],
      { id: 'mock', version: 'mock-1', kind: 'ai' },
      '이벤트 기간: 2026/10/01 10:00 ~ 2026/10/20 10:00 (UTC+8)',
    );
    const report = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(report.validation.REVIEW).toBe(1);
    expect(await store.listContent({})).toHaveLength(0);
    expect(await store.listContent({ statuses: ['PENDING_REVIEW'] })).toHaveLength(1);
  });

  it('runs the registered fixture adapter by id', async () => {
    const definition = getAdapterDefinition('lostark-fixture');
    expect(definition?.supportedModes).toEqual(['fixture']);
    const adapter = definition!.create(createTestAdapterContext({ mode: 'fixture' }));
    const report = await runIngestion(adapter, deps(store), { trigger: 'TEST' });
    expect(report.status).toBe('SUCCEEDED');
    const maintenance = (
      await store.listContent({ types: ['MAINTENANCE'], gameIds: ['lostark'] })
    )[0];
    expect(maintenance?.detail).toMatchObject({
      type: 'MAINTENANCE',
      compensationSlug: 'lost-ark-reward-emergency-maintenance-compensation',
    });
  });
});
