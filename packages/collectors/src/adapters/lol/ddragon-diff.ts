/**
 * Structured differences between two Riot Data Dragon versions (pure functions).
 *
 * Only values Data Dragon publishes as numbers are compared: champion base stats, spell
 * cooldown / cost / range per rank, and Summoner's Rift item prices and stats. Ability
 * descriptions are free text and are deliberately not diffed.
 */
import type { PatchChangeCandidate, PatchChangeType } from '@gamepulse/domain';
import { z } from 'zod';

const SPELL_KEYS = ['Q', 'W', 'E', 'R'] as const;

/** Data Dragon publishes attackdamageperlevel as 0 for every champion (data-quality issue). */
const IGNORED_CHAMPION_STATS = new Set(['attackdamageperlevel']);

const CHAMPION_STAT_LABELS: Readonly<Record<string, string>> = {
  hp: '기본 체력',
  hpperlevel: '레벨당 체력',
  mp: '기본 자원',
  mpperlevel: '레벨당 자원',
  movespeed: '이동 속도',
  armor: '기본 방어력',
  armorperlevel: '레벨당 방어력',
  spellblock: '기본 마법 저항력',
  spellblockperlevel: '레벨당 마법 저항력',
  attackrange: '공격 사거리',
  hpregen: '체력 재생',
  hpregenperlevel: '레벨당 체력 재생',
  mpregen: '자원 재생',
  mpregenperlevel: '레벨당 자원 재생',
  crit: '치명타',
  critperlevel: '레벨당 치명타',
  attackdamage: '기본 공격력',
  attackspeedperlevel: '레벨당 공격 속도',
  attackspeed: '기본 공격 속도',
};

/** Item stat keys; percent stats are published as fractions (0.25 = 25%). */
const ITEM_STAT_LABELS: Readonly<Record<string, { label: string; percent: boolean }>> = {
  FlatArmorMod: { label: '방어력', percent: false },
  FlatCritChanceMod: { label: '치명타 확률', percent: true },
  FlatHPPoolMod: { label: '체력', percent: false },
  FlatHPRegenMod: { label: '체력 재생', percent: false },
  FlatMPPoolMod: { label: '마나', percent: false },
  FlatMagicDamageMod: { label: '주문력', percent: false },
  FlatMovementSpeedMod: { label: '이동 속도', percent: false },
  FlatPhysicalDamageMod: { label: '공격력', percent: false },
  FlatSpellBlockMod: { label: '마법 저항력', percent: false },
  PercentAttackSpeedMod: { label: '공격 속도', percent: true },
  PercentLifeStealMod: { label: '생명력 흡수', percent: true },
  PercentMovementSpeedMod: { label: '이동 속도', percent: true },
};

const numberRecord = z.record(z.string(), z.number());

const championFileSchema = z.object({
  version: z.string().min(1),
  data: z.record(
    z.string(),
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      stats: numberRecord,
      spells: z
        .array(
          z.object({
            name: z.string().min(1),
            cooldown: z.array(z.number()),
            cost: z.array(z.number()),
            range: z.array(z.number()),
          }),
        )
        .max(4),
    }),
  ),
});

const itemFileSchema = z.object({
  version: z.string().min(1),
  data: z.record(
    z.string(),
    z.object({
      // Some mode-specific entries ship with an empty name; they are filtered out below.
      name: z.string(),
      gold: z.object({ total: z.number(), purchasable: z.boolean() }),
      stats: numberRecord.optional(),
      maps: z.record(z.string(), z.boolean()).optional(),
    }),
  ),
});

export interface DDragonSpell {
  key: (typeof SPELL_KEYS)[number];
  name: string;
  cooldown: number[];
  cost: number[];
  range: number[];
}

export interface DDragonChampion {
  id: string;
  name: string;
  stats: Record<string, number>;
  spells: DDragonSpell[];
}

export interface DDragonItem {
  id: string;
  name: string;
  gold: number;
  stats: Record<string, number>;
}

export interface DDragonSnapshot {
  version: string;
  champions: DDragonChampion[];
  items: DDragonItem[];
}

const SUMMONERS_RIFT = '11';

/** Extracts the comparable subset of championFull.json + item.json (validated). */
export function extractSnapshot(championFile: unknown, itemFile: unknown): DDragonSnapshot {
  const champions = championFileSchema.parse(championFile);
  const items = itemFileSchema.parse(itemFile);
  return {
    version: champions.version,
    champions: Object.values(champions.data)
      .map((champion) => ({
        id: champion.id,
        name: champion.name,
        stats: champion.stats,
        spells: champion.spells.map((spell, index) => ({
          key: SPELL_KEYS[index] ?? 'R',
          name: spell.name,
          cooldown: spell.cooldown,
          cost: spell.cost,
          range: spell.range,
        })),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    items: Object.entries(items.data)
      .filter(
        ([, item]) =>
          item.name.trim() !== '' && item.gold.purchasable && item.maps?.[SUMMONERS_RIFT] === true,
      )
      .map(([id, item]) => ({
        id,
        name: item.name,
        gold: item.gold.total,
        stats: item.stats ?? {},
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function formatRanks(values: readonly number[]): string {
  const distinct = new Set(values);
  return distinct.size === 1 ? formatNumber(values[0] ?? 0) : values.map(formatNumber).join('/');
}

/** Direction of a change where larger values are better (or smaller, with lowerIsBetter). */
function direction(
  before: readonly number[],
  after: readonly number[],
  lowerIsBetter: boolean,
): PatchChangeType {
  let up = false;
  let down = false;
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    const a = before[Math.min(index, before.length - 1)] ?? 0;
    const b = after[Math.min(index, after.length - 1)] ?? 0;
    if (b > a) up = true;
    if (b < a) down = true;
  }
  if (up === down) return 'ADJUST';
  const improved = lowerIsBetter ? down : up;
  return improved ? 'BUFF' : 'NERF';
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function championChanges(before: DDragonChampion, after: DDragonChampion): PatchChangeCandidate[] {
  const changes: PatchChangeCandidate[] = [];
  const base = {
    targetType: 'CHAMPION' as const,
    targetKey: after.id,
    targetName: after.name,
    description: null,
  };
  for (const [stat, value] of Object.entries(after.stats)) {
    const previous = before.stats[stat];
    if (IGNORED_CHAMPION_STATS.has(stat) || previous === undefined || previous === value) continue;
    changes.push({
      ...base,
      changeType: direction([previous], [value], false),
      field: CHAMPION_STAT_LABELS[stat] ?? stat,
      beforeValue: formatNumber(previous),
      afterValue: formatNumber(value),
      unit: null,
    });
  }
  after.spells.forEach((spell, index) => {
    const previous = before.spells[index];
    if (!previous) return;
    const fields: Array<{
      key: 'cooldown' | 'cost' | 'range';
      label: string;
      unit: string | null;
      lowerIsBetter: boolean;
    }> = [
      { key: 'cooldown', label: '재사용 대기시간', unit: '초', lowerIsBetter: true },
      { key: 'cost', label: '소모값', unit: null, lowerIsBetter: true },
      { key: 'range', label: '사거리', unit: null, lowerIsBetter: false },
    ];
    for (const field of fields) {
      const a = previous[field.key];
      const b = spell[field.key];
      if (sameNumbers(a, b)) continue;
      changes.push({
        ...base,
        changeType: direction(a, b, field.lowerIsBetter),
        field: `${spell.key} ${spell.name} ${field.label}`,
        beforeValue: formatRanks(a),
        afterValue: formatRanks(b),
        unit: field.unit,
      });
    }
  });
  return changes;
}

function itemChanges(before: DDragonItem, after: DDragonItem): PatchChangeCandidate[] {
  const changes: PatchChangeCandidate[] = [];
  const base = {
    targetType: 'ITEM' as const,
    targetKey: after.id,
    targetName: after.name,
    description: null,
  };
  if (before.gold !== after.gold) {
    changes.push({
      ...base,
      changeType: direction([before.gold], [after.gold], true),
      field: '가격',
      beforeValue: formatNumber(before.gold),
      afterValue: formatNumber(after.gold),
      unit: '골드',
    });
  }
  const keys = [...new Set([...Object.keys(before.stats), ...Object.keys(after.stats)])].sort();
  for (const key of keys) {
    const a = before.stats[key] ?? 0;
    const b = after.stats[key] ?? 0;
    if (a === b) continue;
    const meta = ITEM_STAT_LABELS[key] ?? { label: key, percent: false };
    const scale = (value: number) => (meta.percent ? value * 100 : value);
    changes.push({
      ...base,
      changeType: direction([a], [b], false),
      field: meta.label,
      beforeValue: formatNumber(scale(a)),
      afterValue: formatNumber(scale(b)),
      unit: meta.percent ? '%' : null,
    });
  }
  return changes;
}

export interface DDragonDiff {
  changes: PatchChangeCandidate[];
  championsChanged: number;
  itemsChanged: number;
}

export function diffSnapshots(previous: DDragonSnapshot, current: DDragonSnapshot): DDragonDiff {
  const changes: PatchChangeCandidate[] = [];
  const touched = { champions: new Set<string>(), items: new Set<string>() };

  const previousChampions = new Map(previous.champions.map((champion) => [champion.id, champion]));
  for (const champion of current.champions) {
    const before = previousChampions.get(champion.id);
    const found = before
      ? championChanges(before, champion)
      : [
          {
            targetType: 'CHAMPION' as const,
            targetKey: champion.id,
            targetName: champion.name,
            changeType: 'NEW' as const,
            field: null,
            beforeValue: null,
            afterValue: null,
            unit: null,
            description: null,
          },
        ];
    if (found.length > 0) touched.champions.add(champion.id);
    changes.push(...found);
  }

  const previousItems = new Map(previous.items.map((item) => [item.id, item]));
  const currentItemIds = new Set(current.items.map((item) => item.id));
  for (const item of current.items) {
    const before = previousItems.get(item.id);
    const found = before
      ? itemChanges(before, item)
      : [
          {
            targetType: 'ITEM' as const,
            targetKey: item.id,
            targetName: item.name,
            changeType: 'NEW' as const,
            field: null,
            beforeValue: null,
            afterValue: null,
            unit: null,
            description: null,
          },
        ];
    if (found.length > 0) touched.items.add(item.id);
    changes.push(...found);
  }
  for (const item of previous.items) {
    if (currentItemIds.has(item.id)) continue;
    touched.items.add(item.id);
    changes.push({
      targetType: 'ITEM',
      targetKey: item.id,
      targetName: item.name,
      changeType: 'REMOVED',
      field: null,
      beforeValue: null,
      afterValue: null,
      unit: null,
      description: null,
    });
  }

  return { changes, championsChanged: touched.champions.size, itemsChanged: touched.items.size };
}
