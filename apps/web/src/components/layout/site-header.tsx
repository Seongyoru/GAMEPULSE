import { cx } from '@gamepulse/ui';
import { CalendarDays, Gamepad2, Star, Zap, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ko } from '@/lib/i18n';
import { MyGamesLink } from './my-games-link';
import { NavLink } from './nav-link';

/*
 * One set of primary links, two layouts: a bottom tab bar on phones (never clipped, in thumb
 * reach) and inline in the header bar from `sm` up.
 */
const NAV = cx(
  'fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border/70 bg-surface/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(15_23_42/0.06)] backdrop-blur-md',
  'sm:static sm:flex sm:items-center sm:gap-0.5 sm:border-0 sm:bg-transparent sm:pb-0 sm:shadow-none sm:backdrop-blur-none',
);
const NAV_LINK = cx(
  'group relative flex min-h-14 flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[11px] font-semibold text-muted transition-colors data-active:text-brand',
  'sm:min-h-0 sm:flex-row sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm sm:hover:bg-surface-2 sm:hover:text-text sm:data-active:bg-brand/10 sm:data-active:text-brand',
);

/** Tab icon in an indicator pill on phones; a plain inline icon in the header bar. */
function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid h-7 w-14 place-items-center rounded-full transition-colors group-data-active:bg-brand/12 sm:contents">
      <Icon aria-hidden className="size-5 sm:size-4" />
    </span>
  );
}

export function PulseMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
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
    <header className="sticky top-0 z-30">
      {/* The blur sits on its own layer: backdrop-filter on the header would make it the
          containing block of the fixed tab bar and pin the bar to the header. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 border-b border-border/70 bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/65"
      />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-white shadow-sm shadow-brand/30">
            <PulseMark className="size-5" />
          </span>
          <span className="font-display text-[17px] font-bold tracking-[0.04em] text-text">
            GAMEPULSE
          </span>
        </Link>
        <nav aria-label={ko.nav.primary} className={NAV}>
          <NavLink href="/today" className={NAV_LINK}>
            <NavIcon icon={Zap} />
            {ko.nav.today}
          </NavLink>
          <NavLink href="/games" section className={NAV_LINK}>
            <NavIcon icon={Gamepad2} />
            {ko.nav.games}
          </NavLink>
          <NavLink href="/calendar" className={NAV_LINK}>
            <NavIcon icon={CalendarDays} />
            {ko.nav.calendar}
          </NavLink>
          <MyGamesLink className={NAV_LINK} icon={<NavIcon icon={Star} />} />
        </nav>
      </div>
    </header>
  );
}
