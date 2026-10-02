import Link from 'next/link';
import { ko } from '@/lib/i18n';
import { MyGamesLink } from './my-games-link';

const NAV_LINK =
  'whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text sm:px-2.5';

function PulseMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5 text-brand"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M2 12h4l2.5-6 4 12 3-9 1.5 3H22" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[15px] font-black tracking-[0.08em] text-text"
        >
          <PulseMark />
          GAMEPULSE
        </Link>
        <nav aria-label={ko.nav.primary} className="flex items-center gap-0.5 overflow-x-auto">
          <Link href="/today" className={NAV_LINK}>
            {ko.nav.today}
          </Link>
          <Link href="/games" className={NAV_LINK}>
            {ko.nav.games}
          </Link>
          <Link href="/calendar" className={NAV_LINK}>
            {ko.nav.calendar}
          </Link>
          <MyGamesLink className={NAV_LINK} />
        </nav>
      </div>
    </header>
  );
}
