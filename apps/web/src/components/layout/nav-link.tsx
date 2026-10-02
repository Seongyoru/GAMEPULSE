'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { navMatch } from '@/lib/nav';

export interface NavLinkProps {
  href: string;
  /** Also current on the pages below `href` (a game's pages under /games). */
  section?: boolean;
  className?: string;
  children: ReactNode;
  'data-testid'?: string;
}

/** Primary navigation link marking where the visitor is: aria-current, plus data-active for styling. */
export function NavLink({ href, section = false, className, children, ...rest }: NavLinkProps) {
  const match = navMatch(usePathname() ?? '/', href, section);
  return (
    <Link
      href={href}
      className={className}
      aria-current={match === 'page' ? 'page' : match === 'section' ? 'true' : undefined}
      data-active={match ? '' : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}
