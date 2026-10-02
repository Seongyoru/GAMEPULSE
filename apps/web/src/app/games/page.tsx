import { GAME_FEATURES, listPublicGames, type GameConfig } from '@gamepulse/domain';
import { ACCENT_CLASSES, cx } from '@gamepulse/ui';
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
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">GAMES</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
          {ko.games.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{ko.games.description}</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => {
          const view = gameView(game);
          const features = GAME_FEATURES.filter(
            (feature) => game.features[feature] !== 'unsupported',
          );
          return (
            <li key={game.gameId}>
              <article
                className="flex h-full flex-col rounded-lg border border-border bg-surface"
                data-testid={`game-card-${game.gameId}`}
              >
                <div className="flex-1 space-y-2 p-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-text">
                    <span
                      aria-hidden
                      className={cx(
                        'inline-block size-2.5 rounded-full',
                        ACCENT_CLASSES[view.accent].dot,
                      )}
                    />
                    <Link href={`/games/${game.slug}`} className="hover:underline">
                      {view.name}
                    </Link>
                  </h2>
                  <p className="text-xs text-muted">
                    {game.name} · {game.publisher}
                  </p>
                  <p className="sr-only">{ko.games.features}</p>
                  <ul className="flex flex-wrap gap-1">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted"
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
