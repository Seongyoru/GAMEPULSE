'use client';

import { useEffect } from 'react';
import { isAnalyticsEvent, track } from '@/lib/analytics';

/**
 * One delegated click listener for the whole app: elements declare `data-track-event` (and
 * optionally `data-track-id`); official-source links declare `data-source-link`. No per-card
 * JavaScript is needed for analytics.
 */
export function AnalyticsListener() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const tracked = target.closest<HTMLElement>('[data-track-event]');
      if (tracked) {
        const name = tracked.dataset.trackEvent;
        if (isAnalyticsEvent(name)) track(name, { id: tracked.dataset.trackId ?? null });
        if (name === 'patch_opened' || name === 'reward_opened') {
          track('pulse_opened', { id: tracked.dataset.trackId ?? null });
        }
      }
      const source = target.closest<HTMLAnchorElement>('a[data-source-link]');
      if (source) track('source_clicked', { href: source.href });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);
  return null;
}
