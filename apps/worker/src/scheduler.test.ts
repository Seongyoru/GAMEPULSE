import { parseServerEnv } from '@gamepulse/config';
import { describe, expect, it } from 'vitest';
import { resolveAdapter } from './jobs';
import { planSchedule } from './scheduler';

describe('planSchedule', () => {
  it('refreshes every fixture adapter hourly in fixture mode', () => {
    const { scheduled } = planSchedule(parseServerEnv({ COLLECTOR_MODE: 'fixture' }));
    expect(scheduled.map((entry) => entry.definition.id)).toEqual([
      'lol-fixture',
      'lostark-fixture',
      'maplestory-fixture',
      'genshin-fixture',
      'wuwa-fixture',
    ]);
    expect(scheduled.every((entry) => entry.everyMinutes === 60)).toBe(true);
  });

  it('never schedules fixture adapters in live mode', () => {
    const { scheduled, skipped } = planSchedule(parseServerEnv({ COLLECTOR_MODE: 'live' }));
    expect(scheduled.filter((entry) => entry.definition.source.type === 'FIXTURE')).toEqual([]);
    expect(skipped.find((entry) => entry.adapterId === 'lol-fixture')?.reason).toBe(
      'does not support live mode',
    );
  });
});

describe('production safety', () => {
  it('refuses fixture and mock collection in production', () => {
    for (const mode of ['fixture', 'mock'] as const) {
      const { scheduled, skipped } = planSchedule(
        parseServerEnv({
          NODE_ENV: 'production',
          COLLECTOR_MODE: mode,
          DATABASE_URL: 'postgres://x',
        }),
      );
      expect(scheduled).toEqual([]);
      expect(
        skipped.every((entry) => entry.reason === `${mode} mode is refused in production`),
      ).toBe(true);
    }
  });

  it('allows fixtures in production only when explicitly enabled for previews', () => {
    const { scheduled } = planSchedule(
      parseServerEnv({
        NODE_ENV: 'production',
        COLLECTOR_MODE: 'fixture',
        GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION: 'true',
      }),
    );
    expect(scheduled).toHaveLength(5);
  });
});

describe('resolveAdapter', () => {
  it('rejects unknown adapters and unsupported modes', () => {
    expect(() => resolveAdapter('nope', 'fixture')).toThrow(/Unknown adapter/);
    expect(() => resolveAdapter('genshin-fixture', 'live')).toThrow(/does not support mode "live"/);
    expect(resolveAdapter('genshin-fixture', 'fixture').gameId).toBe('genshin');
  });
});
