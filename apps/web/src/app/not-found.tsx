import Link from 'next/link';
import { ko } from '@/lib/i18n';

export default function NotFound() {
  return (
    <div className="py-24 text-center" data-testid="not-found">
      <p className="font-mono text-sm font-bold text-brand">404</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text">{ko.notFound.title}</h1>
      <p className="mt-2 text-sm text-muted">{ko.notFound.description}</p>
      <Link
        href="/today"
        className="mt-6 inline-flex rounded-md bg-text px-4 py-2 text-sm font-bold text-bg hover:opacity-90"
      >
        {ko.notFound.action}
      </Link>
    </div>
  );
}
