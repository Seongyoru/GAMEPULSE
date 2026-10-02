import { normalizedCandidateSchema } from '@gamepulse/domain';
import { describe, expect, it } from 'vitest';
import { defaultFixturesDir } from '../../context';
import { loadRecordedTransport } from '../../http/recorded';
import { createTestAdapterContext, MockTransport } from '../../testing';
import { LOL_STATUS_URL, LolStatusAdapter } from './status';

describe('LolStatusAdapter', () => {
  it('maps maintenances and player-affecting incidents (mock mode)', async () => {
    const adapter = new LolStatusAdapter(
      createTestAdapterContext({
        mode: 'mock',
        transport: loadRecordedTransport(defaultFixturesDir()),
      }),
    );
    const [resource] = await adapter.discover();
    const { candidates, warnings } = await adapter.normalize(await adapter.fetch(resource!));
    expect(warnings).toEqual([]);
    expect(
      candidates.map((candidate) => [candidate.kind, candidate.sourceKey, candidate.title]),
    ).toEqual([
      ['MAINTENANCE', 'maintenance:990001', '[샘플] 정기 서버 점검 예정'],
      ['ANNOUNCEMENT', 'incident:990002', '[샘플] 일부 지역 접속 지연'],
    ]);
    for (const candidate of candidates)
      expect(normalizedCandidateSchema.safeParse(candidate).success).toBe(true);
    expect(candidates[0]).toMatchObject({
      summary: '[샘플] 서버 안정화를 위한 정기 점검이 예정되어 있습니다.',
      startAt: null,
      sourcePublishedAt: '2026-10-06T06:00:00.000Z',
      sourceUrl: 'https://status.riotgames.com/lol?region=kr&locale=ko_KR',
      metadata: { maintenanceStatus: 'scheduled' },
    });
  });

  it('authenticates with X-Riot-Token and tolerates omitted lists', async () => {
    const transport = new MockTransport().on(LOL_STATUS_URL, { body: { id: 'KR', name: 'Korea' } });
    const adapter = new LolStatusAdapter(
      createTestAdapterContext({
        mode: 'live',
        transport,
        credentials: { RIOT_API_KEY: 'RGAPI-test' },
      }),
    );
    const [resource] = await adapter.discover();
    const { candidates } = await adapter.normalize(await adapter.fetch(resource!));
    expect(candidates).toEqual([]);
    expect(transport.requests[0]?.headers['x-riot-token']).toBe('RGAPI-test');
  });
});
