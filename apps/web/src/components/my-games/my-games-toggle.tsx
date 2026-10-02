'use client';

import { cx } from '@gamepulse/ui';
import { track } from '@/lib/analytics';
import { ko } from '@/lib/i18n';
import { toggleGame, usePreferences } from '@/lib/preferences';

const TONES = {
  /** On page surfaces. */
  surface: {
    shape: 'rounded-md px-3 py-1.5',
    active: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    idle: 'border-border bg-surface text-text hover:border-zinc-400',
  },
  /** On game art (game page hero): solid fills keep the label legible over any part of the art. */
  art: {
    shape: 'rounded-xl px-3.5 py-2',
    active: 'border-emerald-300/40 bg-emerald-700 text-white hover:bg-emerald-800',
    idle: 'border-white bg-white text-zinc-900 hover:bg-white/90',
  },
} as const;

/** "Add to MY GAMES" on game and content pages — the detail → MY GAMES conversion step. */
export function MyGamesToggle({
  gameId,
  source,
  tone = 'surface',
  className,
}: {
  gameId: string;
  source: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const { selectedGameIds } = usePreferences();
  const active = selectedGameIds.includes(gameId);
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid="my-games-toggle"
      onClick={() => {
        const wasEmpty = selectedGameIds.length === 0;
        const { selected } = toggleGame(gameId);
        track(selected ? 'game_selected' : 'game_removed', { gameId, source });
        if (wasEmpty && selected) track('my_games_configured', { gameId, source });
      }}
      className={cx(
        'inline-flex items-center gap-1.5 border text-sm font-bold transition-colors',
        TONES[tone].shape,
        active ? TONES[tone].active : TONES[tone].idle,
        className,
      )}
    >
      <span aria-hidden>{active ? '✓' : '+'}</span>
      {active ? ko.myGames.added : ko.myGames.add}
    </button>
  );
}
