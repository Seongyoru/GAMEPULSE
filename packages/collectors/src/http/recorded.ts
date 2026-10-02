/**
 * Mock mode transport: replays recorded (or documentation-shaped) API responses stored under
 * `fixtures/http/<source-id>/routes.json`, so live adapter code paths run without network
 * access, credentials or quota. Responses are development data and are labelled synthetic.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { MockTransport } from './transport';

const routeSchema = z.object({
  url: z.url(),
  /** exact: the full URL must match; prefix: any URL starting with `url` (query strings vary). */
  match: z.enum(['exact', 'prefix']).default('exact'),
  status: z.number().int().min(100).max(599).default(200),
  headers: z.record(z.string(), z.string()).default({}),
  /** Body file relative to the routes file; omitted for empty bodies. */
  bodyFile: z.string().min(1).optional(),
});

export const recordedRoutesFileSchema = z.object({
  /** Where the response shapes come from (API docs, recorded on <date>…). */
  description: z.string().min(1),
  routes: z.array(routeSchema).min(1),
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function loadRecordedTransport(fixturesDir: string): MockTransport {
  const transport = new MockTransport();
  const root = join(fixturesDir, 'http');
  if (!existsSync(root)) return transport;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const routesFile = join(root, entry.name, 'routes.json');
    if (!existsSync(routesFile)) continue;
    const parsed = recordedRoutesFileSchema.safeParse(JSON.parse(readFileSync(routesFile, 'utf8')));
    if (!parsed.success) {
      throw new Error(
        `Invalid ${routesFile}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
      );
    }
    for (const route of parsed.data.routes) {
      const body = route.bodyFile
        ? readFileSync(join(root, entry.name, route.bodyFile), 'utf8')
        : undefined;
      const pattern =
        route.match === 'exact' ? route.url : new RegExp(`^${escapeRegExp(route.url)}`);
      transport.on(pattern, { status: route.status, headers: route.headers, body });
    }
  }
  return transport;
}
