/**
 * Builds the runtime context handed to adapters: HTTP client (with robots.txt cache and an
 * identifying User-Agent), credentials, clock and fixture settings.
 */
import { join } from 'node:path';
import { findWorkspaceRoot, type ServerEnv } from '@gamepulse/config';
import type { CollectorMode } from '@gamepulse/domain';
import type { Logger } from '@gamepulse/observability';
import type { AIParser } from '@gamepulse/parsers';
import { defaultFixtureAnchor } from './fixtures/relative-time';
import { HttpClient } from './http/client';
import { RobotsCache } from './http/robots';
import { FetchTransport, type HttpTransport } from './http/transport';
import type { AdapterContext, CredentialName } from './types';

/** Absolute path of the repository's /fixtures directory. */
export function defaultFixturesDir(start: string = process.cwd()): string {
  const root = findWorkspaceRoot(start);
  if (!root) throw new Error(`Cannot locate the workspace root from ${start}`);
  return join(root, 'fixtures');
}

export function collectorUserAgent(
  env: Pick<ServerEnv, 'COLLECTOR_USER_AGENT' | 'COLLECTOR_CONTACT'>,
): string {
  return env.COLLECTOR_CONTACT
    ? `${env.COLLECTOR_USER_AGENT} (+${env.COLLECTOR_CONTACT})`
    : env.COLLECTOR_USER_AGENT;
}

export interface CreateAdapterContextOptions {
  mode: CollectorMode;
  env: ServerEnv;
  logger: Logger;
  transport?: HttpTransport;
  parser?: AIParser | null;
  clock?: () => Date;
  fixturesDir?: string;
  fixtureAnchor?: Date;
}

export function createAdapterContext(options: CreateAdapterContextOptions): AdapterContext {
  const clock = options.clock ?? (() => new Date());
  const transport = options.transport ?? new FetchTransport();
  const userAgent = collectorUserAgent(options.env);
  const credentials: Partial<Record<CredentialName, string>> = {};
  if (options.env.RIOT_API_KEY) credentials.RIOT_API_KEY = options.env.RIOT_API_KEY;
  if (options.env.LOSTARK_API_KEY) credentials.LOSTARK_API_KEY = options.env.LOSTARK_API_KEY;
  if (options.env.NEXON_OPEN_API_KEY)
    credentials.NEXON_OPEN_API_KEY = options.env.NEXON_OPEN_API_KEY;

  return {
    mode: options.mode,
    http: new HttpClient({
      transport,
      userAgent,
      logger: options.logger,
      robots: new RobotsCache(transport),
    }),
    logger: options.logger,
    clock,
    credentials,
    fixturesDir: options.fixturesDir ?? defaultFixturesDir(),
    fixtureAnchor:
      options.fixtureAnchor ??
      (options.env.FIXTURE_ANCHOR
        ? new Date(options.env.FIXTURE_ANCHOR)
        : defaultFixtureAnchor(clock())),
    parser: options.parser ?? null,
  };
}
