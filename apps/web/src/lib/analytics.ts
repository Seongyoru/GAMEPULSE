'use client';

/**
 * Analytics abstraction. GA4 is optional; the default provider is a no-op.
 * Events are product events (MY GAMES setup, opens, filters) — never personal data.
 */

export const ANALYTICS_EVENTS = [
  'game_selected',
  'game_removed',
  'pulse_opened',
  'patch_opened',
  'reward_opened',
  'calendar_filtered',
  'source_clicked',
  'my_games_configured',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsProps = Record<string, string | number | boolean | null>;

export interface AnalyticsProvider {
  track(name: AnalyticsEventName, props: AnalyticsProps): void;
}

type GtagWindow = Window & {
  gtag?: (command: 'event', name: string, params: AnalyticsProps) => void;
};

const providers: Record<string, AnalyticsProvider> = {
  none: { track: () => undefined },
  console: {
    // eslint-disable-next-line no-console -- the console provider exists to print events in development
    track: (name, props) => console.info('[analytics]', name, props),
  },
  ga4: {
    track: (name, props) => (window as GtagWindow).gtag?.('event', name, props),
  },
};

function activeProvider(): AnalyticsProvider {
  const configured = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? 'none';
  return providers[configured] ?? providers.none!;
}

export function track(name: AnalyticsEventName, props: AnalyticsProps = {}): void {
  try {
    activeProvider().track(name, props);
  } catch {
    // Analytics must never break the product.
  }
}

export function isAnalyticsEvent(value: string | undefined): value is AnalyticsEventName {
  return value !== undefined && (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
