import { normalizedCandidateSchema } from '@gamepulse/domain';
import { describe, expect, it } from 'vitest';
import { defaultFixturesDir } from '../../context';
import { loadRecordedTransport } from '../../http/recorded';
import { createTestAdapterContext, MockTransport } from '../../testing';
import { championFileUrl, DataDragonAdapter, DDRAGON_BASE } from './ddragon';
import { diffSnapshots, type DDragonSnapshot } from './ddragon-diff';

const snapshot = (overrides: Partial<DDragonSnapshot> = {}): DDragonSnapshot => ({
  version: '1.0.0',
  champions: [
    {
      id: 'Ahri',
      name: '아리',
      stats: { hp: 590, attackdamage: 53, attackdamageperlevel: 0 },
      spells: [
        { key: 'Q', name: '현혹의 구슬', cooldown: [7, 7, 7], cost: [55, 65, 75], range: [970] },
      ],
    },
  ],
  items: [
    {
      id: '3031',
      name: '무한의 대검',
      gold: 3450,
      stats: { FlatPhysicalDamageMod: 65, FlatCritChanceMod: 0.25 },
    },
  ],
  ...overrides,
});

describe('diffSnapshots', () => {
  it('classifies numeric changes by direction and ignores known-bad fields', () => {
    const before = snapshot();
    const after = snapshot({
      champions: [
        {
          id: 'Ahri',
          name: '아리',
          stats: { hp: 600, attackdamage: 53, attackdamageperlevel: 3 },
          spells: [
            {
              key: 'Q',
              name: '현혹의 구슬',
              cooldown: [8, 7, 6],
              cost: [50, 60, 70],
              range: [970],
            },
          ],
        },
      ],
      items: [
        {
          id: '3031',
          name: '무한의 대검',
          gold: 3500,
          stats: { FlatPhysicalDamageMod: 70, FlatCritChanceMod: 0.25 },
        },
      ],
    });
    const diff = diffSnapshots(before, after);
    expect(diff.championsChanged).toBe(1);
    expect(diff.itemsChanged).toBe(1);
    expect(
      diff.changes.map((change) => [
        change.field,
        change.changeType,
        change.beforeValue,
        change.afterValue,
        change.unit,
      ]),
    ).toEqual([
      ['기본 체력', 'BUFF', '590', '600', null],
      ['Q 현혹의 구슬 재사용 대기시간', 'ADJUST', '7', '8/7/6', '초'],
      ['Q 현혹의 구슬 소모값', 'BUFF', '55/65/75', '50/60/70', null],
      ['가격', 'NERF', '3450', '3500', '골드'],
      ['공격력', 'BUFF', '65', '70', null],
    ]);
  });

  it('reports new and removed items and converts percent stats', () => {
    const before = snapshot({ items: [{ id: '1', name: '옛 아이템', gold: 300, stats: {} }] });
    const after = snapshot({
      items: [{ id: '2', name: '새 아이템', gold: 400, stats: { PercentAttackSpeedMod: 0.35 } }],
    });
    const diff = diffSnapshots(before, after);
    expect(diff.changes.map((change) => [change.targetName, change.changeType])).toEqual([
      ['새 아이템', 'NEW'],
      ['옛 아이템', 'REMOVED'],
    ]);
    const atlas = diffSnapshots(
      snapshot({
        items: [{ id: '3', name: '아이템', gold: 400, stats: { PercentAttackSpeedMod: 0.25 } }],
      }),
      snapshot({
        items: [{ id: '3', name: '아이템', gold: 400, stats: { PercentAttackSpeedMod: 0.35 } }],
      }),
    );
    expect(atlas.changes[0]).toMatchObject({
      field: '공격 속도',
      beforeValue: '25',
      afterValue: '35',
      unit: '%',
    });
  });
});

describe('DataDragonAdapter in mock mode (official data excerpts)', () => {
  it('publishes one PATCH record with the structured differences between data versions', async () => {
    const context = createTestAdapterContext({
      mode: 'mock',
      transport: loadRecordedTransport(defaultFixturesDir()),
    });
    const adapter = new DataDragonAdapter(context);
    expect(adapter.source.id).toBe('lol-ddragon-mock');
    const [resource] = await adapter.discover();
    expect(resource?.hints).toEqual({
      version: '16.19.1',
      itemVersion: '16.19.1',
      previousVersion: '16.18.1',
    });
    const document = await adapter.fetch(resource!);
    const { candidates, warnings } = await adapter.normalize(document);
    expect(warnings).toEqual([]);
    expect(candidates).toHaveLength(1);
    const patch = candidates[0]!;
    expect(normalizedCandidateSchema.safeParse(patch).success).toBe(true);
    expect(patch).toMatchObject({
      kind: 'PATCH',
      sourceKey: 'ddragon:16.19.1',
      title: 'Data Dragon 16.19.1 게임 데이터 변경',
      startAt: null,
      sourcePublishedAt: '2026-09-23T21:09:19.000Z',
      isSynthetic: true,
    });
    if (patch.kind !== 'PATCH') throw new Error('expected a patch');
    expect(patch.patch.version).toBe('Data Dragon 16.19.1');
    const rows = patch.patch.changes.map(
      (change) =>
        `${change.targetName}|${change.field}|${change.changeType}|${change.beforeValue}→${change.afterValue}`,
    );
    expect(rows).toEqual([
      '아트록스|W 지옥사슬 재사용 대기시간|BUFF|20/18/16/14/12→18/16.5/15/13.5/12',
      '드레이븐|기본 공격력|BUFF|62→64',
      '피오라|레벨당 체력|BUFF|99→105',
      '녹턴|R 피해망상 재사용 대기시간|NERF|140/115/90→160/130/100',
      '라이즈|레벨당 방어력|BUFF|4.2→4.7',
      '라이즈|E 주문 전이 소모값|NERF|35/45/55/65/75→40/50/60/70/80',
      '바이|기본 공격력|NERF|63→61',
      '세계 지도집|체력|NERF|30→0',
    ]);
    expect(patch.summary).toContain('챔피언 6명, 아이템 1개에서 수치 변경 8건');
  });

  it('skips the downloads when the versioned champion file is unchanged (304)', async () => {
    const transport = new MockTransport()
      .on(`${DDRAGON_BASE}/realms/kr.json`, {
        body: { n: { champion: '16.19.1', item: '16.19.1' } },
      })
      .on(`${DDRAGON_BASE}/api/versions.json`, { body: ['16.19.1', '16.18.1', 'lolpatch_7.20'] })
      .on(championFileUrl('16.19.1'), { status: 304 });
    const adapter = new DataDragonAdapter(createTestAdapterContext({ mode: 'live', transport }));
    const [resource] = await adapter.discover();
    const document = await adapter.fetch(resource!, { etag: '"abc"', lastModified: null });
    expect(document.notModified).toBe(true);
    expect(transport.requests.at(-1)?.headers['if-none-match']).toBe('"abc"');
    expect(transport.requests).toHaveLength(3);
  });

  it('reports health from the realm file', async () => {
    const transport = new MockTransport().on(`${DDRAGON_BASE}/realms/kr.json`, { status: 500 });
    const adapter = new DataDragonAdapter(createTestAdapterContext({ mode: 'live', transport }));
    expect((await adapter.healthCheck()).status).toBe('UNHEALTHY');
  });
});
