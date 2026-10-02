import 'server-only';
import {
  parseServerEnv,
  resolveDataSource,
  type DataSourceKind,
  type ServerEnv,
} from '@gamepulse/config';

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export function dataSourceKind(): DataSourceKind {
  return resolveDataSource(serverEnv());
}

/** Canonical site origin (no production domain is hardcoded). */
export function siteUrl(): string {
  return serverEnv().GAMEPULSE_SITE_URL.replace(/\/$/, '');
}

export type AdsMode = 'off' | 'placeholder';

/** Ad slots stay off unless explicitly enabled; "placeholder" reserves layout for review. */
export function adsMode(): AdsMode {
  return process.env.NEXT_PUBLIC_ADS_MODE === 'placeholder' ? 'placeholder' : 'off';
}

/** GA4 measurement id, only when GA4 is the configured provider and the id is well-formed. */
export function ga4MeasurementId(): string | null {
  if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER !== 'ga4') return null;
  const id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? '';
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}
