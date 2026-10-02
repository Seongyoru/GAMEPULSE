'use client';

import { ko } from '@/lib/i18n';

/** Replaces the root layout when it fails; must render its own document and styles. */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '96px 16px' }}
      >
        <title>GAMEPULSE</title>
        <h1 style={{ fontSize: 24 }}>{ko.error.title}</h1>
        <p style={{ color: '#5b6475' }}>{ko.error.description}</p>
        <button
          type="button"
          onClick={() => retry()}
          style={{ marginTop: 24, padding: '8px 16px' }}
        >
          {ko.error.retry}
        </button>
      </body>
    </html>
  );
}
