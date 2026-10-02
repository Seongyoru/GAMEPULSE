import { normalizedCandidateSchema, type NormalizedCandidate } from '@gamepulse/domain';
import { describe, expect, it } from 'vitest';
import { defaultFixturesDir } from '../../context';
import { HttpError } from '../../http/client';
import { loadRecordedTransport } from '../../http/recorded';
import { createTestAdapterContext, MockTransport } from '../../testing';
import { MapleStoryNoticeAdapter, NEXON_API_BASE, NEXON_ATTRIBUTION } from './nexon';

async function collect(adapter: MapleStoryNoticeAdapter) {
  const candidates: NormalizedCandidate[] = [];
  for (const resource of await adapter.discover()) {
    const result = await adapter.normalize(await adapter.fetch(resource));
    expect(result.warnings).toEqual([]);
    candidates.push(...result.candidates);
  }
  return candidates;
}

describe('MapleStoryNoticeAdapter', () => {
  it('normalizes event, update and general notices (mock mode)', async () => {
    const adapter = new MapleStoryNoticeAdapter(
      createTestAdapterContext({
        mode: 'mock',
        transport: loadRecordedTransport(defaultFixturesDir()),
      }),
    );
    expect(adapter.source).toMatchObject({
      id: 'maplestory-openapi-mock',
      attribution: NEXON_ATTRIBUTION,
    });
    const candidates = await collect(adapter);
    expect(candidates.map((candidate) => [candidate.kind, candidate.sourceKey])).toEqual([
      ['EVENT', 'event:900101'],
      ['EVENT', 'event:900102'],
      ['UPDATE', 'update:900201'],
      ['MAINTENANCE', 'notice:900301'],
      ['ANNOUNCEMENT', 'notice:900302'],
    ]);
    for (const candidate of candidates) {
      expect(normalizedCandidateSchema.safeParse(candidate).success).toBe(true);
      expect(candidate.isSynthetic).toBe(true);
    }
    expect(candidates[0]).toMatchObject({
      startAt: '2026-09-25T01:00:00.000Z',
      endAt: '2026-10-22T14:59:00.000Z',
      sourcePublishedAt: '2026-09-25T01:00:00.000Z',
      timing: { sourceTimezone: 'Asia/Seoul', startAtSource: '2026-09-25T10:00+09:00' },
    });
    expect(candidates[3]).toMatchObject({ startAt: null, endAt: null, priority: 75 });
  });

  it('sends the API key header in live mode and does not retry rejected keys', async () => {
    const transport = new MockTransport().on(`${NEXON_API_BASE}/maplestory/v1/notice-event`, {
      status: 400,
      body: { error: { name: 'OPENAPI00005', message: 'Please input valid key' } },
    });
    const adapter = new MapleStoryNoticeAdapter(
      createTestAdapterContext({
        mode: 'live',
        transport,
        credentials: { NEXON_OPEN_API_KEY: 'test-key' },
      }),
    );
    expect(adapter.source.id).toBe('maplestory-openapi');
    const [resource] = await adapter.discover();
    await expect(adapter.fetch(resource!)).rejects.toBeInstanceOf(HttpError);
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]?.headers['x-nxopen-api-key']).toBe('test-key');
  });
});
