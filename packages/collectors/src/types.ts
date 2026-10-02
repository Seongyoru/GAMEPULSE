/**
 * Universal Source Adapter contract. Adapters never write to the database: they discover,
 * fetch and normalize; the ingestion pipeline validates, deduplicates and publishes.
 */
import type {
  CollectorMode,
  JsonValue,
  NormalizedCandidate,
  SourceDefinition,
} from '@gamepulse/domain';
import type { Logger } from '@gamepulse/observability';
import type { AIParser } from '@gamepulse/parsers';
import type { HttpClient } from './http/client';

export interface DiscoveredResource {
  /** Stable id of the document within the source; null when the URL is the identity. */
  externalId: string | null;
  url: string;
  /** Data captured during discovery (list-page fields, published date…). */
  hints?: { [key: string]: JsonValue };
}

/** A fetched source document (the spec's RawDocument before it is stored). */
export interface FetchedDocument {
  sourceId: string;
  externalId: string | null;
  url: string;
  contentType: string;
  rawText: string;
  fetchedAt: string;
  httpStatus: number | null;
  etag: string | null;
  lastModified: string | null;
  locale: string | null;
  /** True when the source answered 304 Not Modified (rawText is then empty). */
  notModified: boolean;
  metadata: { [key: string]: JsonValue } | null;
}

/** How candidates were produced; drives the validation engine's evidence rules. */
export type NormalizeParserKind = 'deterministic' | 'ai' | 'manual' | 'fixture';

export interface NormalizeResult {
  candidates: NormalizedCandidate[];
  parser: { id: string; version: string; kind: NormalizeParserKind };
  /** Plain text the candidates were derived from (evidence verification), when meaningful. */
  documentText: string | null;
  /** Non-fatal notes (skipped sections, dropped items). */
  warnings: string[];
}

export type AdapterHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DISABLED';

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface AdapterHealth {
  adapterId: string;
  status: AdapterHealthStatus;
  checkedAt: string;
  checks: HealthCheck[];
}

export interface SourceAdapter {
  readonly id: string;
  readonly gameId: string;
  readonly source: SourceDefinition;
  readonly mode: CollectorMode;
  discover(): Promise<DiscoveredResource[]>;
  /** `previous` carries validators of the last stored version for conditional requests. */
  fetch(
    resource: DiscoveredResource,
    previous?: { etag: string | null; lastModified: string | null } | null,
  ): Promise<FetchedDocument>;
  normalize(document: FetchedDocument): Promise<NormalizeResult>;
  healthCheck(): Promise<AdapterHealth>;
}

export const CREDENTIAL_NAMES = ['RIOT_API_KEY', 'LOSTARK_API_KEY', 'NEXON_OPEN_API_KEY'] as const;
export type CredentialName = (typeof CREDENTIAL_NAMES)[number];

export interface AdapterContext {
  mode: CollectorMode;
  http: HttpClient;
  logger: Logger;
  clock: () => Date;
  /** Server-side secrets. Never sent to clients. */
  credentials: Partial<Record<CredentialName, string>>;
  /** Absolute path of the repository's /fixtures directory. */
  fixturesDir: string;
  /** Anchor instant for relative fixture dates. */
  fixtureAnchor: Date;
  /** Optional parser for adapters that need text understanding. */
  parser: AIParser | null;
}

export interface AdapterDefinition {
  id: string;
  gameId: string;
  source: SourceDefinition;
  description: string;
  supportedModes: readonly CollectorMode[];
  /** Credentials required in live mode. */
  credentials: readonly CredentialName[];
  /** Suggested live polling interval for the worker scheduler; null = not scheduled. */
  scheduleEveryMinutes: number | null;
  /** True when normalize() needs context.parser (unstructured text). */
  usesParser?: boolean;
  create(context: AdapterContext): SourceAdapter;
}

export class AdapterUnavailableError extends Error {
  override name = 'AdapterUnavailableError';
}
