/**
 * Identity helpers used for idempotent ingestion and cross-source deduplication.
 *
 *  - sourceKey:   stable id of an item within one source (provided by the adapter)
 *  - semanticKey: source-independent identity (game + kind + normalized title + start day),
 *                 used to detect the same fact arriving from different sources
 *  - slug:        stable, ASCII, URL-safe; assigned once at creation and never changed
 */
import type { ContentType } from './enums';
import type { NormalizedCandidate } from './schemas/candidate';

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Deterministic JSON serialization with sorted object keys (undefined values are dropped). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 'null' : serialized;
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry === undefined ? null : entry)).join(',')}]`;
  }
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return stableStringify((value as { toJSON: () => unknown }).toJSON());
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

/** 32-bit FNV-1a hash as 8 hex chars. Non-cryptographic; used for short stable suffixes. */
export function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Lowercase ASCII slug: "Lantern Rite 2026!" → "lantern-rite-2026". Non-ASCII is dropped. */
export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

const KIND_SLUG: Readonly<Record<ContentType, string>> = {
  PATCH: 'patch',
  UPDATE: 'update',
  EVENT: 'event',
  BANNER: 'banner',
  REWARD: 'reward',
  REDEEM_CODE: 'code',
  MAINTENANCE: 'maintenance',
  ANNOUNCEMENT: 'notice',
};

/** Builds the preferred slug for a new record. The store appends a suffix on collision. */
export function buildContentSlug(input: {
  gameSlug: string;
  candidate: NormalizedCandidate;
}): string {
  const { gameSlug, candidate } = input;
  const kind = KIND_SLUG[candidate.kind];
  if (candidate.kind === 'PATCH') {
    const version = slugify(candidate.patch.version, 40);
    if (version) return `${gameSlug}-${kind}-${version}`;
  }
  const base =
    slugify(candidate.slugHint ?? candidate.sourceKey, 72) || fnv1a32(candidate.sourceKey);
  return `${gameSlug}-${kind}-${base}`.slice(0, 120).replace(/-+$/g, '');
}

/** Suffix used when a preferred slug is already taken by a different record. */
export function slugWithSuffix(slug: string, uniqueSeed: string): string {
  return `${slug.slice(0, 110)}-${fnv1a32(uniqueSeed)}`;
}

/** Normalizes a title for identity comparison: NFKC, lowercase, bracket tags and punctuation removed. */
export function normalizeTitleForIdentity(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[[【〔(（<〈][^\]】〕)）>〉]{0,24}[\]】〕)）>〉]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 120);
}

function utcDay(iso: string | null): string {
  if (iso === null) return 'na';
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : 'na';
}

/** Source-independent identity of a candidate. */
export function semanticKey(candidate: NormalizedCandidate): string {
  switch (candidate.kind) {
    case 'PATCH':
      return `${candidate.gameId}:PATCH:${candidate.patch.version.trim().toLowerCase()}`;
    case 'REDEEM_CODE':
      return `${candidate.gameId}:REDEEM_CODE:${candidate.redeemCode.code.trim().toUpperCase()}`;
    default:
      return `${candidate.gameId}:${candidate.kind}:${normalizeTitleForIdentity(candidate.title)}:${utcDay(candidate.startAt)}`;
  }
}

/** Key identifying one document within a source: external id when available, else the URL. */
export function documentKey(input: { externalId: string | null; url: string }): string {
  return input.externalId ?? input.url;
}
