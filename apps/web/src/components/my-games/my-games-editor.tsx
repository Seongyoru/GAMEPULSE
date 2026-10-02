'use client';

import { listGames } from '@gamepulse/domain';
import { GameFilter } from '@gamepulse/ui/client';
import Link from 'next/link';
import { track } from '@/lib/analytics';
import { ko } from '@/lib/i18n';
import { toggleGame, usePreferences } from '@/lib/preferences';
import { gameView } from '@/lib/present';

const GAME_OPTIONS = listGames().map((game) => {
  const view = gameView(game);
  return { gameId: view.gameId, name: view.name, accent: view.accent };
});

export function MyGamesEditor() {
  const { selectedGameIds } = usePreferences();
  const t = ko.myGames;

  const onToggle = (gameId: string) => {
    const wasEmpty = selectedGameIds.length === 0;
    const { selected } = toggleGame(gameId);
    track(selected ? 'game_selected' : 'game_removed', { gameId, source: 'my-games' });
    if (wasEmpty && selected) track('my_games_configured', { gameId });
  };

  return (
    <div className="space-y-4">
      <GameFilter
        games={GAME_OPTIONS}
        selected={selectedGameIds}
        onToggle={onToggle}
        label={t.filterLabel}
      />
      <p className="text-sm text-muted" data-testid="my-games-status">
        {selectedGameIds.length > 0 ? t.selected(selectedGameIds.length) : t.noneSelected}
      </p>
      <Link
        href="/today"
        className="inline-flex rounded-md bg-text px-4 py-2 text-sm font-bold text-bg hover:opacity-90"
      >
        {t.done}
      </Link>
    </div>
  );
}
