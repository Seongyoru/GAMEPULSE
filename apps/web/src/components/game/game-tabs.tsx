'use client';

import { cx } from '@gamepulse/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface GameTabLink {
  tab: string;
  label: string;
  href: string;
}

export function GameTabs({ tabs, label }: { tabs: readonly GameTabLink[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mb-px flex gap-1 overflow-x-auto" data-testid="game-tabs">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.tab}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
              active ? 'border-brand text-text' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
