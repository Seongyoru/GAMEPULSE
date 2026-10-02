'use client';

import { useState } from 'react';
import { ko } from '@/lib/i18n';

/** Copy button for real redeem codes. Synthetic codes never get one. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-bold text-text hover:border-zinc-400"
    >
      {copied ? ko.detail.copied : ko.detail.copy}
    </button>
  );
}
