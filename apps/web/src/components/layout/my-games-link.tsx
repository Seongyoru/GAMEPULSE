'use client';

import type { ReactNode } from 'react';
import { ko } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences';
import { NavLink } from './nav-link';

/** A bubble on the tab icon on phones, a pill after the label in the header bar. */
const COUNT_BADGE =
  'absolute left-1/2 top-1 ml-1.5 min-w-4 rounded-full bg-brand px-1 text-center font-mono text-[10px] font-bold leading-4 tabular-nums text-bg ring-2 ring-surface sm:static sm:ml-0 sm:min-w-0 sm:rounded sm:bg-brand/15 sm:text-[11px] sm:leading-normal sm:text-brand sm:ring-0';

/** Navigation link showing how many games are selected (0 renders no badge, matching SSR). */
export function MyGamesLink({ className, icon }: { className?: string; icon?: ReactNode }) {
  const { selectedGameIds } = usePreferences();
  return (
    <NavLink href="/my-games" className={className} data-testid="nav-my-games">
      {icon}
      {ko.nav.myGames}
      {selectedGameIds.length > 0 ? (
        <span className={COUNT_BADGE}>{selectedGameIds.length}</span>
      ) : null}
    </NavLink>
  );
}
