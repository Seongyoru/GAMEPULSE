import { isPublicGameId } from '@gamepulse/domain';
import { GameMark, type GameArtSpec } from '@gamepulse/ui';
import Link from 'next/link';
import { ko } from '@/lib/i18n';
import { gameViewById } from '@/lib/present';
import { PulseMark } from './site-header';

const FOOTER_LINK = 'hover:text-white';

export function SiteFooter({ games }: { games: readonly GameArtSpec[] }) {
  const views = games.map((game) => gameViewById(game.gameId));
  return (
    <footer className="mt-16 bg-[#070a12] text-sm text-zinc-400">
      {/* Phones: room below the last line for the fixed tab bar (site-header). */}
      <div className="mx-auto max-w-6xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-12 sm:pb-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-3">
            <p className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
                <PulseMark className="size-5" />
              </span>
              <span className="font-display text-lg font-bold tracking-[0.04em] text-white">
                GAMEPULSE
              </span>
            </p>
            <p className="text-zinc-300">{ko.site.tagline}</p>
            <p>{ko.footer.sources}</p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label={ko.nav.games}>
            {views.map((view) => (
              <li key={view.gameId}>
                <Link
                  href={`/games/${view.slug}`}
                  className="block rounded-xl transition-transform hover:-translate-y-0.5"
                  title={view.name}
                >
                  <GameMark gameId={view.gameId} label={view.shortName} />
                  <span className="sr-only">{view.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <nav
          className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-6 font-semibold text-zinc-300"
          aria-label="footer"
        >
          <Link href="/games" className={FOOTER_LINK}>
            {ko.nav.games}
          </Link>
          <Link href="/calendar" className={FOOTER_LINK}>
            {ko.nav.calendar}
          </Link>
          <Link href="/sources" className={FOOTER_LINK}>
            데이터 출처
          </Link>
          <Link href="/terms" className={FOOTER_LINK}>
            이용약관
          </Link>
          <Link href="/privacy" className={FOOTER_LINK}>
            개인정보 처리방침
          </Link>
        </nav>
        <div className="mt-6 space-y-2 text-xs leading-relaxed">
          <p>{ko.footer.disclaimer}</p>
          {/* Riot's required notice, while a Riot game is listed. */}
          {isPublicGameId('lol') ? <p lang="en">{ko.footer.riot}</p> : null}
        </div>
      </div>
    </footer>
  );
}
