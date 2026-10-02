/**
 * Test helpers for adapters: an offline context with a scripted transport and a virtual clock.
 */
import { noopLogger, type Logger } from '@gamepulse/observability';
import type { AIParser } from '@gamepulse/parsers';
import { defaultFixturesDir } from '../context';
import { HttpClient } from '../http/client';
import { RobotsCache } from '../http/robots';
import { MockTransport } from '../http/transport';
import type { AdapterContext, CredentialName } from '../types';

export { MockTransport } from '../http/transport';

export const TEST_ANCHOR = new Date('2026-10-02T03:00:00.000Z');

export interface TestContextOptions {
  mode?: AdapterContext['mode'];
  transport?: MockTransport;
  now?: Date;
  anchor?: Date;
  credentials?: Partial<Record<CredentialName, string>>;
  parser?: AIParser | null;
  logger?: Logger;
}

export function createTestAdapterContext(
  options: TestContextOptions = {},
): AdapterContext & { transport: MockTransport } {
  const transport = options.transport ?? new MockTransport();
  let virtualNow = (options.now ?? TEST_ANCHOR).getTime();
  const sleep = (ms: number) => {
    virtualNow += ms;
    return Promise.resolve();
  };
  const logger = options.logger ?? noopLogger;
  return {
    mode: options.mode ?? 'mock',
    transport,
    http: new HttpClient({
      transport,
      userAgent: 'GAMEPULSE-Collector/test',
      logger,
      robots: new RobotsCache(transport, () => virtualNow),
      clock: () => virtualNow,
      sleep,
      random: () => 0.5,
    }),
    logger,
    clock: () => new Date(virtualNow),
    credentials: options.credentials ?? {},
    fixturesDir: defaultFixturesDir(),
    fixtureAnchor: options.anchor ?? TEST_ANCHOR,
    parser: options.parser ?? null,
  };
}
