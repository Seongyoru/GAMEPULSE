'use client';

import { cx } from '@gamepulse/ui';
import { track } from '@/lib/analytics';
import { ko } from '@/lib/i18n';
import { toggleGame, usePreferences } from '@/lib/preferences';

/** "Add to MY GAMES" on game and content pages — the detail → MY GAMES conversion step. */
export function MyGamesToggle({
  gameId,
  source,
  className,
}: {
  gameId: string;
  source: string;
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
        'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-bold transition-colors',
        active
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-border bg-surface text-text hover:border-zinc-400',
        className,
      )}
    >
      <span aria-hidden>{active ? '✓' : '+'}</span>
      {active ? ko.myGames.added : ko.myGames.add}
    </button>
  );
}
