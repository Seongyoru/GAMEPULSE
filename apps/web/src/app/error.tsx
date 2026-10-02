'use client';

import { ko } from '@/lib/i18n';

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="py-24 text-center" role="alert">
      <h1 className="text-2xl font-extrabold tracking-tight text-text">{ko.error.title}</h1>
      <p className="mt-2 text-sm text-muted">{ko.error.description}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 inline-flex rounded-md bg-text px-4 py-2 text-sm font-bold text-bg hover:opacity-90"
      >
        {ko.error.retry}
      </button>
    </div>
  );
}
