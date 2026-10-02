import { normalizedCandidateSchema, type NormalizedCandidate } from '@gamepulse/domain';
import { describe, expect, it } from 'vitest';
import { defaultFixturesDir } from '../../context';
import { HttpError } from '../../http/client';
import { loadRecordedTransport } from '../../http/recorded';
import { createTestAdapterContext, MockTransport } from '../../testing';
import { AdapterUnavailableError, type SourceAdapter } from '../../types';
import { LOSTARK_API_BASE, LostArkOpenApiAdapter } from './adapter';

async function collect(adapter: SourceAdapter) {
  const candidates: NormalizedCandidate[] = [];
  const warnings: string[] = [];
  for (const resource of await adapter.discover()) {
    const result = await adapter.normalize(await adapter.fetch(resource));
    candidates.push(...result.candidates);
    warnings.push(...result.warnings);
  }
  return { candidates, warnings };
}

const EVENTS_URL = `${LOSTARK_API_BASE}/news/events`;

describe('LostArkOpenApiAdapter in mock mode (recorded responses)', () => {
  const context = () =>
    createTestAdapterContext({
      mode: 'mock',
      transport: loadRecordedTransport(defaultFixturesDir()),
    });

  it('normalizes events, reward claim deadlines, maintenance and notices', async () => {
    const adapter = new LostArkOpenApiAdapter(context());
    const { candidates, warnings } = await collect(adapter);
    expect(warnings).toEqual([]);
    expect(candidates.map((candidate) => candidate.kind)).toEqual([
      'EVENT',
      'REWARD',
      'EVENT',
      'EVENT',
      'MAINTENANCE',
      'MAINTENANCE',
      'ANNOUNCEMENT',
    ]);
    for (const candidate of candidates) {
      expect(normalizedCandidateSchema.safeParse(candidate).success).toBe(true);
      expect(candidate.isSynthetic).toBe(true);
      expect(candidate.sourceUrl.startsWith('https://lostark.game.onstove.com/')).toBe(true);
    }
    expect(new Set(candidates.map((candidate) => candidate.sourceKey)).size).toBe(
      candidates.length,
    );

    const [event, reward, , permanent, maintenance, emergency, notice] = candidates;
    // 10:00 KST = 01:00 UTC; the original strings are kept for audit.
    expect(event).toMatchObject({
      startAt: '2026-09-24T01:00:00.000Z',
      endAt: '2026-10-21T21:00:00.000Z',
      summary: null,
      timing: {
        sourceTimezone: 'Asia/Seoul',
        startAtSource: '2026-09-24T10:00:00',
        endAtSource: '2026-10-22T06:00:00',
        region: 'kr',
      },
    });
    expect(reward).toMatchObject({
      kind: 'REWARD',
      title: '[샘플] 가을 수확 출석 이벤트 보상 수령',
      endAt: '2026-10-28T21:00:00.000Z',
      reward: { rewardType: 'EVENT', items: [], relatedSourceKey: event?.sourceKey },
    });
    expect(permanent?.endAt).toBeNull(); // 9999-12-31 is a "no end" sentinel, not a date
    expect(maintenance).toMatchObject({
      startAt: null,
      endAt: null,
      sourcePublishedAt: '2026-10-06T05:00:00.000Z',
    });
    expect(maintenance?.kind === 'MAINTENANCE' && maintenance.maintenance.maintenanceType).toBe(
      'SCHEDULED',
    );
    expect(emergency?.kind === 'MAINTENANCE' && emergency.maintenance.maintenanceType).toBe(
      'EMERGENCY',
    );
    expect(notice).toMatchObject({ kind: 'ANNOUNCEMENT', priority: 40 });
  });

  it('stores mock data under a fixture twin source and never sends credentials', async () => {
    const ctx = context();
    const adapter = new LostArkOpenApiAdapter(ctx);
    expect(adapter.source).toMatchObject({ id: 'lostark-openapi-mock', type: 'FIXTURE' });
    await collect(adapter);
    expect(ctx.transport.requests).toHaveLength(3);
    expect(ctx.transport.requests.every((request) => !('authorization' in request.headers))).toBe(
      true,
    );
    expect((await adapter.healthCheck()).status).toBe('HEALTHY');
  });
});

describe('LostArkOpenApiAdapter in live mode', () => {
  it('authenticates, uses article ids as identity and skips unexpected items', async () => {
    const transport = new MockTransport().on(EVENTS_URL, {
      body: [
        {
          Title: '가을 이벤트',
          Thumbnail: '',
          Link: 'https://lostark.game.onstove.com/News/Event/Views/2155',
          StartDate: '2026-10-01T10:00:00',
          EndDate: '2026-10-15T06:00:00',
          RewardDate: null,
        },
        { Title: '외부 링크', Link: 'https://example.com/event', StartDate: null, EndDate: null },
        { Unexpected: true },
      ],
    });
    const context = createTestAdapterContext({
      mode: 'live',
      transport,
      credentials: { LOSTARK_API_KEY: 'test-key' },
    });
    const adapter = new LostArkOpenApiAdapter(context);
    expect(adapter.source.id).toBe('lostark-openapi');
    const [resource] = await adapter.discover();
    const document = await adapter.fetch(resource!);
    expect(transport.requests[0]?.headers.authorization).toBe('bearer test-key');
    const { candidates, warnings } = await adapter.normalize(document);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      sourceKey: 'event:2155',
      slugHint: 'event-2155',
      isSynthetic: false,
    });
    expect(warnings).toHaveLength(2);
  });

  it('refuses to run without an API key', async () => {
    const adapter = new LostArkOpenApiAdapter(createTestAdapterContext({ mode: 'live' }));
    const [resource] = await adapter.discover();
    await expect(adapter.fetch(resource!)).rejects.toBeInstanceOf(AdapterUnavailableError);
    expect((await adapter.healthCheck()).status).toBe('DISABLED');
  });

  it('surfaces API maintenance (503) after bounded retries', async () => {
    const transport = new MockTransport().on(EVENTS_URL, { status: 503, body: '' });
    const adapter = new LostArkOpenApiAdapter(
      createTestAdapterContext({ mode: 'live', transport, credentials: { LOSTARK_API_KEY: 'k' } }),
    );
    const [resource] = await adapter.discover();
    await expect(adapter.fetch(resource!)).rejects.toBeInstanceOf(HttpError);
    expect(transport.requests).toHaveLength(4);
    const health = await adapter.healthCheck();
    expect(health.status).toBe('DEGRADED');
    expect(health.checks.find((check) => check.name === 'events endpoint')?.ok).toBe(false);
  });
});
