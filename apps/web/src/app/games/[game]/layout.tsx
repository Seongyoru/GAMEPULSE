import { GameCover } from '@gamepulse/ui';
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
      <header className="space-y-4 pt-5">
        <nav aria-label="breadcrumb" className="text-xs text-muted">
          <Link href="/" className="hover:text-text hover:underline">
            {ko.nav.home}
          </Link>
          <span aria-hidden> › </span>
          <Link href="/games" className="hover:text-text hover:underline">
            {ko.nav.games}
          </Link>
        </nav>
        <GameCover
          gameId={game.gameId}
          className="rounded-3xl shadow-xl shadow-zinc-900/10 dark:shadow-black/40"
        >
          <div className="flex min-h-56 flex-col justify-end gap-5 p-5 sm:min-h-64 sm:flex-row sm:items-end sm:justify-between sm:p-8">
            <div className="min-w-0">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                {game.name} · {game.publisher}
              </p>
              <p className="font-title mt-2 text-5xl leading-none text-white [text-shadow:0_3px_14px_rgb(0_0_0/0.5)] sm:text-6xl">
                {view.name}
              </p>
              <p className="mt-3 text-sm text-white/85">
                {ko.game.publisher} {game.publisher} · {ko.game.timezone} {zoneLabel(game.timezone)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={game.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-source-link
                className="rounded-xl bg-white/15 px-3.5 py-2 text-sm font-bold text-white ring-1 ring-inset ring-white/30 backdrop-blur-sm transition hover:bg-white/25"
              >
                {ko.game.official} ↗
              </a>
              <MyGamesToggle gameId={game.gameId} source="game-header" tone="art" />
            </div>
          </div>
        </GameCover>
        <GameTabs tabs={gameTabs(game)} label={`${view.name} 메뉴`} />
      </header>
      {children}
    </div>
  );
}
