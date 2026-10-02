import { type GameConfig } from '@gamepulse/domain';
import { EmptyState } from '@gamepulse/ui';
import type { ReactNode } from 'react';
import { ko } from '@/lib/i18n';
import { gameView } from '@/lib/present';
import { gameTabPath, isTabAvailable, type GameTab } from '@/server/games';
import { breadcrumbJsonLd, gameJsonLd } from '@/server/seo';
import { JsonLdScript } from '../content/json-ld';

/** Shared frame of every /games/[game] tab: structured data, heading, unsupported state. */
export function GameTabPage({
  game,
  tab,
  children,
}: {
  game: GameConfig;
  tab: GameTab;
  children: ReactNode;
}) {
  const view = gameView(game);
  const crumbs = [
    { name: ko.nav.home, path: '/' },
    { name: ko.nav.games, path: '/games' },
    { name: view.name, path: gameTabPath(game, 'overview') },
    ...(tab === 'overview' ? [] : [{ name: ko.game.tabs[tab], path: gameTabPath(game, tab) }]),
  ];
  return (
    <div className="space-y-6">
      <JsonLdScript
        data={[breadcrumbJsonLd(crumbs), ...(tab === 'overview' ? [gameJsonLd(game)] : [])]}
      />
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text">
          {ko.game.pageTitle[tab](view.name)}
        </h1>
        <p className="mt-1 text-sm text-muted">{ko.game.pageDescription[tab](view.name)}</p>
      </div>
      {isTabAvailable(game, tab) ? children : <EmptyState title={ko.game.unsupported} />}
    </div>
  );
}
