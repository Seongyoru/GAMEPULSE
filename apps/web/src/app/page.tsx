import { listPublicGames } from '@gamepulse/domain';
import { GameCover } from '@gamepulse/ui';
import Link from 'next/link';
import { JsonLdScript } from '@/components/content/json-ld';
import { HomePulse } from '@/components/home/home-pulse';
import { ko } from '@/lib/i18n';
import { gameView } from '@/lib/present';
import { getDashboardData } from '@/server/content';
import { pageMetadata, websiteJsonLd } from '@/server/seo';

export const revalidate = 300;

export const metadata = pageMetadata({
  title: ko.meta.homeTitle,
  description: ko.site.description,
  path: '/',
  absoluteTitle: true,
});

const PULSE_PATH = 'M0 82 H520 l26-46 34 86 30-104 26 64 18-18 H1400';

/** Title cards three per row; a shorter last row is centred (honeycomb). */
function posterClass(index: number, count: number): string {
  const remainder = count % 3;
  if (index !== count - remainder) return 'col-span-2';
  return remainder === 2
    ? 'col-span-2 col-start-2'
    : remainder === 1
      ? 'col-span-2 col-start-3'
      : 'col-span-2';
}

export default async function HomePage() {
  const data = await getDashboardData();
  const t = ko.home;
  const games = listPublicGames().map(gameView);
  return (
    <>
      <JsonLdScript data={websiteJsonLd()} />
      <section
        aria-labelledby="home-hero"
        className="relative mt-6 overflow-hidden rounded-3xl bg-[#0a0f1d] text-white shadow-2xl shadow-zinc-900/20"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(640px_320px_at_8%_0%,rgb(225_29_72/0.38),transparent_62%),radial-gradient(560px_320px_at_96%_18%,rgb(99_102_241/0.38),transparent_62%)]"
        />
        <svg
          aria-hidden
          viewBox="0 0 1400 140"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-20 w-full"
        >
          <path d={PULSE_PATH} fill="none" stroke="rgb(251 113 133 / 0.22)" strokeWidth="2" />
          <path
            d={PULSE_PATH}
            className="gp-pulse-line"
            fill="none"
            stroke="#fb7185"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="relative grid gap-10 p-6 pb-16 sm:p-10 sm:pb-20 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.24em] text-rose-300">
              {t.heroEyebrow}
            </p>
            <h1
              id="home-hero"
              className="mt-3 whitespace-pre-line font-display text-[2.6rem] font-bold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl"
            >
              {t.heroTitle}
            </h1>
            <p className="mt-5 max-w-md text-base text-zinc-300 sm:text-lg">{t.heroSubtitle}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link
                href="/my-games"
                className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-950/40 transition hover:bg-rose-500"
                data-testid="hero-choose-games"
              >
                {t.chooseGames}
              </Link>
              <Link
                href="/today"
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/15"
              >
                {t.openToday}
              </Link>
            </div>
          </div>
          <ul className="grid grid-cols-6 gap-2.5 sm:gap-3" aria-label={t.supportedGames}>
            {games.map((game, index) => (
              <li key={game.gameId} className={posterClass(index, games.length)}>
                <Link href={`/games/${game.slug}`} className="group block rounded-2xl">
                  <GameCover
                    gameId={game.gameId}
                    className="aspect-[3/4] rounded-2xl ring-1 ring-white/15 transition duration-300 group-hover:-translate-y-1 group-hover:ring-white/40"
                  >
                    <div className="flex h-full flex-col justify-end p-2.5 sm:p-3">
                      <span className="font-title text-lg leading-tight text-white [text-shadow:0_2px_10px_rgb(0_0_0/0.55)] sm:text-2xl">
                        {game.name}
                      </span>
                      <span className="mt-1 hidden font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/70 sm:block">
                        {game.publisher}
                      </span>
                    </div>
                  </GameCover>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <HomePulse items={data.items} resets={data.resets} generatedAt={data.generatedAt} />
    </>
  );
}
