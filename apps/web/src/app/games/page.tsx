import { GAME_FEATURES, listPublicGames, type GameConfig } from '@gamepulse/domain';
import { GameCover } from '@gamepulse/ui';
import Link from 'next/link';
import { JsonLdScript } from '@/components/content/json-ld';
import { MyGamesToggle } from '@/components/my-games/my-games-toggle';
import { ko } from '@/lib/i18n';
import { gameView, typeLabel } from '@/lib/present';
import { breadcrumbJsonLd, pageMetadata } from '@/server/seo';

export const metadata = pageMetadata({
  title: ko.games.title,
  description: ko.games.description,
  path: '/games',
});

function featureLabel(game: GameConfig, feature: (typeof GAME_FEATURES)[number]): string {
  return feature === 'banners' ? typeLabel('BANNER', game.gameId) : ko.game.feature[feature];
}

export default function GamesPage() {
  const games = listPublicGames();
  return (
    <div className="space-y-6 pt-6">
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: ko.nav.home, path: '/' },
          { name: ko.nav.games, path: '/games' },
        ])}
      />
      <header>
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
          GAMES
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
          {ko.games.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{ko.games.description}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => {
          const view = gameView(game);
          const features = GAME_FEATURES.filter(
            (feature) => game.features[feature] !== 'unsupported',
          );
          return (
            <li key={game.gameId}>
              <article
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(15_23_42/0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/10 dark:hover:shadow-black/40"
                data-testid={`game-card-${game.gameId}`}
              >
                <Link href={`/games/${game.slug}`} className="block">
                  <GameCover gameId={game.gameId} className="h-40">
                    <div className="flex h-full flex-col justify-end p-4">
                      <h2 className="font-title text-3xl leading-none text-white [text-shadow:0_2px_10px_rgb(0_0_0/0.5)]">
                        {view.name}
                      </h2>
                      <p className="mt-1.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
                        {game.name} · {game.publisher}
                      </p>
                    </div>
                  </GameCover>
                </Link>
                <div className="flex-1 space-y-2 p-4">
                  <p className="sr-only">{ko.games.features}</p>
                  <ul className="flex flex-wrap gap-1">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted"
                      >
                        {featureLabel(game, feature)}
                        {game.features[feature] === 'limited' ? ` (${ko.game.limited})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                  <Link
                    href={`/games/${game.slug}`}
                    className="text-sm font-semibold text-text hover:underline"
                  >
                    {ko.games.open} →
                  </Link>
                  <MyGamesToggle gameId={game.gameId} source="games-index" />
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
