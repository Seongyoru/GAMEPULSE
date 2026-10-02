/**
 * Building blocks shared by live adapters (official APIs): fetching JSON documents with the
 * polite HTTP client, health reports and identity helpers.
 */
import { fnv1a32, normalizeTitleForIdentity, type JsonValue } from '@gamepulse/domain';
import type { RateLimitPolicy } from '../http/rate-limit';
import type {
  AdapterContext,
  AdapterHealth,
  AdapterHealthStatus,
  DiscoveredResource,
  FetchedDocument,
  HealthCheck,
} from '../types';

export interface JsonFetchOptions {
  headers?: Record<string, string>;
  rateLimitKey: string;
  rateLimit: RateLimitPolicy;
  locale: string | null;
}

/** GETs a JSON API resource and wraps it as a raw document (conditional when validators exist). */
export async function fetchJsonDocument(
  context: AdapterContext,
  sourceId: string,
  resource: DiscoveredResource,
  previous: { etag: string | null; lastModified: string | null } | null | undefined,
  options: JsonFetchOptions,
): Promise<FetchedDocument> {
  const response = await context.http.get(resource.url, {
    headers: { accept: 'application/json', ...options.headers },
    rateLimitKey: options.rateLimitKey,
    rateLimit: options.rateLimit,
    conditional: previous ?? null,
  });
  const metadata: { [key: string]: JsonValue } = { ...(resource.hints ?? {}) };
  return {
    sourceId,
    externalId: resource.externalId,
    url: resource.url,
    contentType: response.headers['content-type'] ?? 'application/json',
    rawText: response.status === 304 ? '' : response.body,
    fetchedAt: context.clock().toISOString(),
    httpStatus: response.status,
    etag: response.headers.etag ?? null,
    lastModified: response.headers['last-modified'] ?? null,
    locale: options.locale,
    notModified: response.status === 304,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}

export function healthReport(
  adapterId: string,
  checks: HealthCheck[],
  now: Date,
  overrideStatus?: AdapterHealthStatus,
): AdapterHealth {
  const failed = checks.filter((check) => !check.ok).length;
  const status: AdapterHealthStatus =
    overrideStatus ??
    (failed === 0 ? 'HEALTHY' : failed === checks.length ? 'UNHEALTHY' : 'DEGRADED');
  return { adapterId, status, checkedAt: now.toISOString(), checks };
}

/** Numeric article id from an official URL path (".../Views/13555" → "13555"). */
export function trailingNumericId(url: string, marker: RegExp): string | null {
  try {
    const match = marker.exec(new URL(url).pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Fallback identity for items without an id: normalized title + first-seen start value. */
export function contentFingerprint(...parts: Array<string | null>): string {
  return fnv1a32(
    parts.map((part) => (part === null ? '' : normalizeTitleForIdentity(part))).join('|'),
  );
}

/** True when the URL's host is one of the allowed hosts (subdomains included). */
export function isAllowedHost(url: string, allowedHosts: readonly string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}
