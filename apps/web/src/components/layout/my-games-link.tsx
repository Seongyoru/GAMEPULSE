'use client';

import Link from 'next/link';
import { ko } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences';

/** Header link showing how many games are selected (0 renders no badge, matching SSR). */
export function MyGamesLink({ className }: { className?: string }) {
  const { selectedGameIds } = usePreferences();
  return (
    <Link href="/my-games" className={className} data-testid="nav-my-games">
      {ko.nav.myGames}
      {selectedGameIds.length > 0 ? (
        <span className="ml-1 rounded bg-brand/15 px-1 font-mono text-[11px] font-bold tabular-nums text-brand">
          {selectedGameIds.length}
        </span>
      ) : null}
    </Link>
  );
}
