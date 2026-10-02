import Link from 'next/link';
import { ko } from '@/lib/i18n';

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-8 text-xs leading-relaxed text-muted">
      <div className="mx-auto max-w-6xl space-y-2 px-4">
        <p className="font-semibold text-text">
          GAMEPULSE · <span className="font-normal">{ko.site.tagline}</span>
        </p>
        <p>{ko.footer.sources}</p>
        <p>{ko.footer.disclaimer}</p>
        <p lang="en">{ko.footer.riot}</p>
        <nav className="flex gap-3 pt-1" aria-label="footer">
          <Link href="/games" className="hover:text-text">
            {ko.nav.games}
          </Link>
          <Link href="/calendar" className="hover:text-text">
            {ko.nav.calendar}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
