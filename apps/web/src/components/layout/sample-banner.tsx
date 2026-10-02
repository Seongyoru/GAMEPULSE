import { ko } from '@/lib/i18n';

/** Shown on every page whenever synthetic fixture data is being served. */
export function SampleDataBanner() {
  return (
    <div
      role="note"
      data-testid="sample-banner"
      className="border-b border-fuchsia-500/30 bg-fuchsia-500/10"
    >
      <p className="mx-auto max-w-6xl px-4 py-1.5 text-xs font-medium text-fuchsia-800 dark:text-fuchsia-200">
        {ko.site.sampleBanner}
      </p>
    </div>
  );
}
