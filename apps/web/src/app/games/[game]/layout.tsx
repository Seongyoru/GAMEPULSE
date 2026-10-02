import { ACCENT_CLASSES, cx } from '@gamepulse/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GameTabs } from '@/components/game/game-tabs';
import { MyGamesToggle } from '@/components/my-games/my-games-toggle';
import { ko } from '@/lib/i18n';
import { gameView, zoneLabel } from '@/lib/present';
import { gameFromParam, gameTabs, type GameParams } from '@/server/games';

export default async function GameLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: GameParams;
}) {
  const { game: slug } = await params;
  const game = gameFromParam(slug);
  const view = gameView(game);
  return (
    <div className="space-y-6" data-testid="game-page" data-game-id={game.gameId}>
      <header className="space-y-4 border-b border-border pt-5">
        <nav aria-label="breadcrumb" className="text-xs text-muted">
          <Link href="/" className="hover:text-text hover:underline">
            {ko.nav.home}
          </Link>
          <span aria-hidden> › </span>
          <Link href="/games" className="hover:text-text hover:underline">
            {ko.nav.games}
          </Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
              <span
                aria-hidden
                className={cx(
                  'inline-block size-3 shrink-0 rounded-full',
                  ACCENT_CLASSES[view.accent].dot,
                )}
              />
              {view.name}
            </p>
            <p className="mt-1 text-sm text-muted">
              {game.name} · {ko.game.publisher} {game.publisher} · {ko.game.timezone}{' '}
              {zoneLabel(game.timezone)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={game.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-source-link
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text hover:border-zinc-400"
            >
              {ko.game.official} ↗
            </a>
            <MyGamesToggle gameId={game.gameId} source="game-header" />
          </div>
        </div>
        <GameTabs tabs={gameTabs(game)} label={`${view.name} 메뉴`} />
      </header>
      {children}
    </div>
  );
}
