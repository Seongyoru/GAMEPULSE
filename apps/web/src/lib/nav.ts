/** Primary navigation: which link marks where the visitor is. */

/** Drops the trailing slash static hosting adds (trailingSlash: true) so paths compare equal. */
export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * "page" when `pathname` is `href` itself, "section" when it lies below an `href` that covers a
 * section (e.g. a game's pages under /games), otherwise null.
 */
export function navMatch(
  pathname: string,
  href: string,
  section = false,
): 'page' | 'section' | null {
  const path = normalizePath(pathname);
  if (path === href) return 'page';
  if (section && path.startsWith(`${href}/`)) return 'section';
  return null;
}
