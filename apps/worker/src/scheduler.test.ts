import { parseServerEnv } from '@gamepulse/config';
import { listPublicGames } from '@gamepulse/domain';
import { describe, expect, it } from 'vitest';
import { resolveAdapter } from './jobs';
import { planSchedule } from './scheduler';

describe('planSchedule', () => {
  it('refreshes every fixture adapter hourly in fixture mode', () => {
    const { scheduled, skipped } = planSchedule(parseServerEnv({ COLLECTOR_MODE: 'fixture' }));
    expect(scheduled.map((entry) => entry.definition.id)).toEqual(
      listPublicGames().map((game) => `${game.gameId}-fixture`),
    );
    // Hidden (INACTIVE) games keep their fixtures for operators but are never scheduled.
    expect(skipped.find((entry) => entry.adapterId === 'lostark-fixture')?.reason).toBe(
      'game is hidden (INACTIVE)',
    );
    expect(scheduled.every((entry) => entry.everyMinutes === 60)).toBe(true);
  });

  it('never schedules adapters of hidden (INACTIVE) games, in any mode', () => {
    const hideLol = { isGameCollected: (gameId: string) => gameId !== 'lol' };
    for (const mode of ['fixture', 'live'] as const) {
      const { scheduled, skipped } = planSchedule(
        parseServerEnv({ COLLECTOR_MODE: mode }),
        hideLol,
      );
      expect(scheduled.some((entry) => entry.definition.gameId === 'lol')).toBe(false);
      expect(skipped.find((entry) => entry.adapterId === 'lol-fixture')?.reason).toBe(
        'game is hidden (INACTIVE)',
      );
      expect(skipped.find((entry) => entry.adapterId === 'lol-ddragon')?.reason).toBe(
        'game is hidden (INACTIVE)',
      );
    }
  });

  it('never schedules fixture adapters in live mode', () => {
    const { scheduled, skipped } = planSchedule(parseServerEnv({ COLLECTOR_MODE: 'live' }));
    expect(scheduled.filter((entry) => entry.definition.source.type === 'FIXTURE')).toEqual([]);
    expect(skipped.find((entry) => entry.adapterId === 'genshin-fixture')?.reason).toBe(
      'does not support live mode',
    );
  });
});

describe('live schedule', () => {
  it('schedules only ENABLED sources and skips held ones with a reason', () => {
    // As if the PC games were public again: their API sources are the only live adapters.
    const everyGame = { isGameCollected: () => true };
    const { scheduled, skipped } = planSchedule(
      parseServerEnv({
        COLLECTOR_MODE: 'live',
        LOSTARK_API_KEY: 'k',
        NEXON_OPEN_API_KEY: 'k',
        RIOT_API_KEY: 'k',
      }),
      everyGame,
    );
    expect(scheduled.map((entry) => [entry.definition.id, entry.everyMinutes])).toEqual([
      ['lol-ddragon', 180],
    ]);
    expect(skipped.find((entry) => entry.adapterId === 'lostark-openapi')?.reason).toBe(
      'source is PENDING_REVIEW',
    );
    expect(skipped.find((entry) => entry.adapterId === 'maplestory-openapi')?.reason).toBe(
      'source is PENDING_REVIEW',
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
    expect(scheduled).toHaveLength(listPublicGames().length);
  });
});

describe('resolveAdapter', () => {
  it('rejects unknown adapters and unsupported modes', () => {
    expect(() => resolveAdapter('nope', 'fixture')).toThrow(/Unknown adapter/);
    expect(() => resolveAdapter('genshin-fixture', 'live')).toThrow(/does not support mode "live"/);
    expect(resolveAdapter('genshin-fixture', 'fixture').gameId).toBe('genshin');
  });
});
