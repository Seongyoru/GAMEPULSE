/**
 * Shared behavioural contract for ContentStore implementations. Both the in-memory store
 * (unit tests) and the PostgreSQL store (integration tests) must pass the same suite.
 */
import {
  buildContentSlug,
  fnv1a32,
  GAMES,
  semanticKey,
  stableStringify,
  type ContentStore,
  type NormalizedCandidate,
  type PublishInput,
  type SourceDefinition,
} from '@gamepulse/domain';
import { makeCandidate, makeResetRule, makeSource } from '@gamepulse/domain/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

export interface StoreHarness {
  store: () => ContentStore;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

const NOW = '2026-10-02T03:00:00.000Z';
const LATER = '2026-10-02T04:00:00.000Z';

export const CONTRACT_SOURCES: Record<'fixture' | 'official' | 'manual', SourceDefinition> = {
  fixture: makeSource(),
  official: makeSource({
    id: 'genshin-official',
    name: '원신 공식 홈페이지',
    type: 'OFFICIAL_WEB',
    isOfficial: true,
    collectorStatus: 'DISABLED',
  }),
  manual: makeSource({
    id: 'genshin-manual',
    name: 'GAMEPULSE 운영자 입력',
    type: 'MANUAL',
    collectorStatus: 'MANUAL_ONLY',
  }),
};

export function contractPublishInput(
  candidate: NormalizedCandidate,
  source: SourceDefinition,
  overrides: Partial<PublishInput> = {},
): PublishInput {
  return {
    candidate,
    source,
    semanticKey: semanticKey(candidate),
    contentHash: fnv1a32(stableStringify(candidate)),
    slug: buildContentSlug({ gameSlug: 'genshin-impact', candidate }),
    status: 'PUBLISHED',
    verification: 'UNVERIFIED',
    verifiedAt: null,
    validationStatus: 'VALID',
    parser: { id: 'test-parser', version: '1' },
    rawDocumentId: null,
    now: NOW,
    supersedeId: null,
    ...overrides,
  };
}

const richEvent = makeCandidate('EVENT', {
  sourceKey: 'event-lantern',
  slugHint: 'lantern-rite',
  title: '해등절 축제',
  summary: '합성 테스트 이벤트',
  startAt: '2026-10-01T02:00:00Z',
  endAt: '2026-10-20T19:59:00+00:00',
  timing: {
    sourceTimezone: 'UTC+8',
    startAtSource: '2026/10/01 10:00 (UTC+8)',
    endAtSource: '2026/10/21 03:59 (UTC+8)',
    region: 'asia',
    precision: 'DATETIME',
  },
  event: {
    eventType: 'IN_GAME',
    eligibility: '모험 등급 20 이상',
    rewardSummary: '원석 x420',
    rewards: [
      { name: '원석', quantity: 420, unit: null },
      { name: '영웅의 경험', quantity: 10, unit: '개' },
    ],
  },
});

const rewardForEvent = makeCandidate('REWARD', {
  sourceKey: 'reward-lantern-login',
  title: '해등절 접속 보상',
  startAt: '2026-10-01T02:00:00Z',
  endAt: '2026-10-10T02:00:00Z',
  reward: {
    rewardType: 'LOGIN',
    howToClaim: '이벤트 페이지에서 수령',
    items: [{ name: '뒤엉킨 인연', quantity: 10, unit: null }],
    relatedSourceKey: 'event-lantern',
  },
});

const patch = makeCandidate('PATCH', {
  sourceKey: 'patch-6-1',
  title: '6.1 버전 업데이트',
  startAt: '2026-09-30T22:00:00Z',
  patch: {
    version: '6.1',
    releaseAt: '2026-09-30T22:00:00Z',
    changes: [
      {
        targetType: 'CHARACTER',
        targetKey: 'synthetic-hero',
        targetName: '합성 영웅',
        changeType: 'BUFF',
        field: '기본 공격력',
        beforeValue: '100',
        afterValue: '110',
        unit: null,
        description: null,
      },
      {
        targetType: 'SYSTEM',
        targetKey: null,
        targetName: '시스템',
        changeType: 'SYSTEM',
        field: null,
        beforeValue: null,
        afterValue: null,
        unit: null,
        description: '편의성 개선',
      },
    ],
  },
});

const banner = makeCandidate('BANNER', {
  sourceKey: 'banner-1',
  title: '합성 기원',
  startAt: '2026-10-01T02:00:00Z',
  endAt: '2026-10-21T09:59:00Z',
  banner: {
    bannerType: 'CHARACTER',
    phase: 1,
    featured: [
      { name: '합성 영웅', entityKey: 'synthetic-hero', rarity: 5 },
      { name: '조연', entityKey: null, rarity: 4 },
    ],
  },
});

export function describeContentStoreContract(
  name: string,
  createHarness: () => Promise<StoreHarness>,
): void {
  describe(`ContentStore contract — ${name}`, () => {
    let harness: StoreHarness;
    const store = () => harness.store();

    beforeAll(async () => {
      harness = await createHarness();
    });

    beforeEach(async () => {
      await harness.reset();
      await store().syncGames(GAMES, NOW);
      await store().syncSources(Object.values(CONTRACT_SOURCES), NOW);
    });

    afterAll(async () => {
      await harness.close();
    });

    it('syncs registry data idempotently', async () => {
      expect(await store().syncGames(GAMES, LATER)).toEqual({
        created: 0,
        updated: 0,
        unchanged: GAMES.length,
      });
      const changed = { ...CONTRACT_SOURCES.manual, notes: 'changed' };
      expect(await store().syncSources([changed], LATER)).toEqual({
        created: 0,
        updated: 1,
        unchanged: 0,
      });
      const rule = makeResetRule({
        id: 'genshin-daily',
        gameId: 'genshin',
        frequency: 'DAILY',
        dayOfWeek: null,
        timezone: 'UTC+8',
      });
      expect(await store().syncResetRules([rule], NOW)).toEqual({
        created: 1,
        updated: 0,
        unchanged: 0,
      });
      expect(await store().syncResetRules([rule], LATER)).toEqual({
        created: 0,
        updated: 0,
        unchanged: 1,
      });
      expect(await store().listResetRules(['genshin'])).toEqual([rule]);
      expect(await store().listResetRules(['lol'])).toEqual([]);
    });

    it('enforces a single running ingestion per adapter and releases stale locks', async () => {
      const base = {
        adapterId: 'genshin-fixture',
        sourceId: 'genshin-fixture',
        gameId: 'genshin',
        trigger: 'TEST' as const,
        mode: 'fixture' as const,
        staleAfterMs: 60 * 60 * 1000,
      };
      const first = await store().startRun({ ...base, now: NOW });
      expect(first?.status).toBe('RUNNING');
      expect(await store().startRun({ ...base, now: LATER })).toBeNull();

      const afterStale = await store().startRun({ ...base, now: '2026-10-02T05:00:00.001Z' });
      expect(afterStale).not.toBeNull();
      const counters = {
        discovered: 3,
        fetched: 3,
        new: 2,
        updated: 1,
        unchanged: 0,
        failed: 0,
        skipped: 0,
      };
      await store().finishRun(afterStale?.id ?? '', {
        status: 'SUCCEEDED',
        counters,
        error: null,
        finishedAt: LATER,
      });
      const runs = await store().listRuns(10);
      expect(runs.map((run) => run.status).sort()).toEqual(['ABANDONED', 'SUCCEEDED']);
      expect(runs.find((run) => run.status === 'SUCCEEDED')?.counters).toEqual(counters);
      expect(await store().startRun({ ...base, now: LATER })).not.toBeNull();
    });

    it('stores raw documents by content hash and prunes raw text', async () => {
      const doc = {
        sourceId: 'genshin-fixture',
        documentKey: 'doc-1',
        externalId: 'doc-1',
        url: 'https://genshin.hoyoverse.com/ko/news',
        contentHash: 'hash-a',
        contentType: 'application/json',
        rawText: '{"a":1}',
        fetchedAt: NOW,
        httpStatus: 200,
        etag: null,
        lastModified: null,
        locale: 'ko-KR',
        ingestionRunId: null,
        metadata: null,
      };
      const first = await store().insertRawDocument(doc);
      expect((await store().insertRawDocument({ ...doc, fetchedAt: NOW })).id).toBe(first.id);
      expect((await store().findLatestRawDocument('genshin-fixture', 'doc-1'))?.contentHash).toBe(
        'hash-a',
      );

      await store().insertRawDocument({ ...doc, contentHash: 'hash-b', fetchedAt: LATER });
      expect((await store().findLatestRawDocument('genshin-fixture', 'doc-1'))?.contentHash).toBe(
        'hash-b',
      );
      expect(await store().findLatestRawDocument('genshin-fixture', 'missing')).toBeNull();

      expect(await store().pruneRawText(LATER)).toBe(1);
      expect(await store().pruneRawText(LATER)).toBe(0);
    });

    it('caches parse results by input hash, parser and version', async () => {
      const result = {
        rawDocumentId: null,
        parserId: 'mock',
        parserVersion: '1',
        inputHash: 'abc',
        status: 'SUCCEEDED' as const,
        output: { candidates: [] },
        error: null,
        model: null,
        usage: null,
        createdAt: NOW,
      };
      expect(await store().findParseResult('abc', 'mock', '1')).toBeNull();
      await store().insertParseResult(result);
      await store().insertParseResult(result);
      expect(await store().findParseResult('abc', 'mock', '1')).toEqual({
        output: { candidates: [] },
      });
      expect(await store().findParseResult('abc', 'mock', '2')).toBeNull();
    });

    it('publishes, detects unchanged content and updates in place', async () => {
      const created = await store().publishContent(
        contractPublishInput(richEvent, CONTRACT_SOURCES.fixture),
      );
      expect(created.outcome).toBe('created');
      expect(created.slug).toBe('genshin-impact-event-lantern-rite');

      const again = await store().publishContent(
        contractPublishInput(richEvent, CONTRACT_SOURCES.fixture, { now: LATER }),
      );
      expect(again).toEqual({ ...created, outcome: 'unchanged' });

      const changed = { ...richEvent, title: '해등절 축제 (연장)', endAt: '2026-10-25T19:59:00Z' };
      const updated = await store().publishContent(
        contractPublishInput(changed, CONTRACT_SOURCES.fixture, { now: LATER }),
      );
      expect(updated).toEqual({ ...created, outcome: 'updated' });

      const record = await store().getContentBySlug(created.slug);
      expect(record).toMatchObject({
        id: created.id,
        title: '해등절 축제 (연장)',
        endAt: '2026-10-25T19:59:00.000Z',
        publishedAt: NOW,
        updatedAt: LATER,
      });
    });

    it('round-trips every detail type exactly', async () => {
      await store().publishContent(contractPublishInput(richEvent, CONTRACT_SOURCES.fixture));
      await store().publishContent(contractPublishInput(rewardForEvent, CONTRACT_SOURCES.fixture));
      await store().publishContent(contractPublishInput(patch, CONTRACT_SOURCES.fixture));
      await store().publishContent(contractPublishInput(banner, CONTRACT_SOURCES.fixture));
      const code = makeCandidate('REDEEM_CODE', {
        sourceKey: 'code-1',
        redeemCode: {
          code: 'GPTEST-NOTREAL-01',
          region: 'asia',
          items: [{ name: '원석', quantity: 60, unit: null }],
        },
      });
      const maintenance = makeCandidate('MAINTENANCE', {
        sourceKey: 'maint-1',
        startAt: '2026-10-08T22:00:00Z',
        endAt: '2026-10-09T03:00:00Z',
        maintenance: {
          maintenanceType: 'SCHEDULED',
          affectedServers: ['asia', 'europe'],
          compensationSourceKey: 'reward-lantern-login',
        },
      });
      await store().publishContent(contractPublishInput(code, CONTRACT_SOURCES.fixture));
      await store().publishContent(contractPublishInput(maintenance, CONTRACT_SOURCES.fixture));

      const event = await store().getContentBySlug('genshin-impact-event-lantern-rite');
      expect(event).toMatchObject({
        type: 'EVENT',
        startAt: '2026-10-01T02:00:00.000Z',
        endAt: '2026-10-20T19:59:00.000Z',
        timing: richEvent.timing,
        isSynthetic: true,
        source: { id: 'genshin-fixture', type: 'FIXTURE', url: richEvent.sourceUrl },
        detail: {
          type: 'EVENT',
          eventType: 'IN_GAME',
          eligibility: '모험 등급 20 이상',
          rewardSummary: '원석 x420',
          rewards: richEvent.event.rewards,
        },
      });
      expect(event?.provenance).toHaveLength(1);
      expect(event?.provenance[0]).toMatchObject({ sourceId: 'genshin-fixture', role: 'PRIMARY' });

      const reward = await store().getContentBySlug(
        buildContentSlug({ gameSlug: 'genshin-impact', candidate: rewardForEvent }),
      );
      expect(reward?.detail).toEqual({
        type: 'REWARD',
        rewardType: 'LOGIN',
        howToClaim: '이벤트 페이지에서 수령',
        items: [{ name: '뒤엉킨 인연', quantity: 10, unit: null }],
        relatedSlug: 'genshin-impact-event-lantern-rite',
      });

      const patchRecord = await store().getContentBySlug('genshin-impact-patch-6-1');
      expect(patchRecord?.detail).toEqual({
        type: 'PATCH',
        version: '6.1',
        releaseAt: '2026-09-30T22:00:00.000Z',
        changes: patch.patch.changes,
      });

      const bannerRecord = await store().getContentBySlug(
        buildContentSlug({ gameSlug: 'genshin-impact', candidate: banner }),
      );
      expect(bannerRecord?.detail).toEqual({
        type: 'BANNER',
        bannerType: 'CHARACTER',
        phase: 1,
        featured: banner.banner.featured,
      });

      const codeRecord = await store().getContentBySlug(
        buildContentSlug({ gameSlug: 'genshin-impact', candidate: code }),
      );
      expect(codeRecord?.detail).toEqual({
        type: 'REDEEM_CODE',
        code: 'GPTEST-NOTREAL-01',
        region: 'asia',
        items: code.redeemCode.items,
      });

      const maintenanceRecord = await store().getContentBySlug(
        buildContentSlug({ gameSlug: 'genshin-impact', candidate: maintenance }),
      );
      expect(maintenanceRecord?.detail).toEqual({
        type: 'MAINTENANCE',
        maintenanceType: 'SCHEDULED',
        affectedServers: ['asia', 'europe'],
        compensationSlug: reward?.slug,
      });
    });

    it('keeps slugs unique and stable', async () => {
      const a = makeCandidate('EVENT', { sourceKey: 'a', slugHint: 'same' });
      const b = makeCandidate('EVENT', { sourceKey: 'b', slugHint: 'same' });
      const first = await store().publishContent(contractPublishInput(a, CONTRACT_SOURCES.fixture));
      const second = await store().publishContent(
        contractPublishInput(b, CONTRACT_SOURCES.fixture),
      );
      expect(first.slug).toBe('genshin-impact-event-same');
      expect(second.slug).toMatch(/^genshin-impact-event-same-[0-9a-f]{8}$/);
      const renamed = await store().publishContent(
        contractPublishInput({ ...a, slugHint: 'renamed' }, CONTRACT_SOURCES.fixture, {
          now: LATER,
        }),
      );
      expect(renamed.slug).toBe(first.slug);
    });

    it('finds content by source key, semantic key and provenance; supersedes weaker sources', async () => {
      const manualCandidate = { ...richEvent, sourceKey: 'manual-1', isSynthetic: false };
      const manual = await store().publishContent(
        contractPublishInput(manualCandidate, CONTRACT_SOURCES.manual),
      );
      expect((await store().findContentBySourceKey('genshin-manual', 'manual-1'))?.id).toBe(
        manual.id,
      );
      const bySemantic = await store().findContentBySemanticKey(
        'genshin',
        semanticKey(manualCandidate),
      );
      expect(bySemantic.map((ref) => ref.sourceType)).toEqual(['MANUAL']);

      const officialCandidate = {
        ...richEvent,
        sourceKey: 'official-99',
        isSynthetic: false,
        title: '해등절 축제 [공식]',
      };
      const superseded = await store().publishContent(
        contractPublishInput(officialCandidate, CONTRACT_SOURCES.official, {
          supersedeId: manual.id,
          verification: 'AUTO_VERIFIED',
          verifiedAt: LATER,
          now: LATER,
        }),
      );
      expect(superseded).toEqual({ id: manual.id, slug: manual.slug, outcome: 'updated' });

      const record = await store().getContentBySlug(manual.slug);
      expect(record?.source.id).toBe('genshin-official');
      expect(record?.verification).toBe('AUTO_VERIFIED');
      expect(record?.provenance.map((p) => [p.sourceId, p.role])).toEqual([
        ['genshin-official', 'PRIMARY'],
        ['genshin-manual', 'SUPPORTING'],
      ]);
      // The weaker source's key still resolves to the record through provenance.
      expect((await store().findContentBySourceKey('genshin-manual', 'manual-1'))?.id).toBe(
        manual.id,
      );

      await store().recordProvenance(manual.id, {
        sourceId: 'genshin-fixture',
        sourceKey: 'fx-1',
        sourceUrl: richEvent.sourceUrl,
        rawDocumentId: null,
        role: 'SUPPORTING',
        seenAt: LATER,
      });
      expect((await store().findContentBySourceKey('genshin-fixture', 'fx-1'))?.id).toBe(manual.id);
    });

    it('applies content queries consistently', async () => {
      const mk = (key: string, overrides: Partial<NormalizedCandidate>) =>
        store().publishContent(
          contractPublishInput(
            { ...makeCandidate('EVENT', { sourceKey: key }), ...overrides } as NormalizedCandidate,
            CONTRACT_SOURCES.fixture,
          ),
        );
      await mk('past', { startAt: '2026-09-01T00:00:00Z', endAt: '2026-09-10T00:00:00Z' });
      await mk('live', { startAt: '2026-09-25T00:00:00Z', endAt: '2026-10-20T00:00:00Z' });
      await mk('open', { startAt: '2026-08-01T00:00:00Z', endAt: null });
      await mk('future', { startAt: '2026-11-01T00:00:00Z', endAt: '2026-11-10T00:00:00Z' });
      await store().publishContent(
        contractPublishInput(
          {
            ...patch,
            sourceKey: 'p-old',
            patch: { ...patch.patch, version: '5.0' },
            startAt: '2026-01-01T00:00:00Z',
          },
          CONTRACT_SOURCES.fixture,
        ),
      );
      await store().publishContent(contractPublishInput(patch, CONTRACT_SOURCES.fixture));
      await store().publishContent(
        contractPublishInput(
          makeCandidate('EVENT', { sourceKey: 'hidden' }),
          CONTRACT_SOURCES.fixture,
          { status: 'PENDING_REVIEW' },
        ),
      );

      const window = { from: '2026-09-28T00:00:00Z', to: '2026-10-09T00:00:00Z' };
      const inWindow = await store().listContent({ window });
      expect(inWindow.map((r) => r.slug).sort()).toEqual(
        [
          'genshin-impact-event-live',
          'genshin-impact-event-open',
          'genshin-impact-patch-6-1',
        ].sort(),
      );
      const ordered = await store().listContent({ order: 'start', types: ['EVENT'] });
      expect(ordered.map((r) => r.slug)).toEqual([
        'genshin-impact-event-open',
        'genshin-impact-event-past',
        'genshin-impact-event-live',
        'genshin-impact-event-future',
      ]);
      const recent = await store().listContent({ order: 'recent', limit: 2 });
      expect(recent.map((r) => r.slug)).toEqual([
        'genshin-impact-event-future',
        'genshin-impact-patch-6-1',
      ]);
      expect(await store().listContent({ gameIds: ['lol'] })).toEqual([]);
      expect(await store().listContent({ includeSynthetic: false })).toEqual([]);
      expect(
        (await store().listContent({ statuses: ['PENDING_REVIEW'] })).map((r) => r.slug),
      ).toEqual(['genshin-impact-event-hidden']);
      expect(await store().getContentBySlug('genshin-impact-event-hidden')).toBeNull();

      const slugs = await store().listContentSlugs();
      expect(slugs).toHaveLength(6);
      expect(slugs.every((entry) => entry.gameId === 'genshin')).toBe(true);
      expect(await store().getLastUpdatedAt('genshin')).toBe(NOW);
      expect(await store().getLastUpdatedAt('lol')).toBeNull();
    });
  });
}
