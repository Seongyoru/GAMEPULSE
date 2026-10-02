/**
 * robots.txt support (RFC 9309 semantics): longest matching rule wins, Allow wins ties,
 * `*` and `$` wildcards. Unreachable robots.txt (5xx/network) disallows crawling; 4xx means
 * "no robots.txt" and allows it. Website collectors must call this before fetching.
 */
import type { HttpTransport } from './transport';

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

export interface RobotsRules {
  groups: Group[];
}

export function parseRobotsTxt(text: string): RobotsRules {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (line === '') continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      lastWasAgent = false;
      if (value !== '') current.rules.push({ allow: key === 'allow', pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  return { groups };
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Product token of a User-Agent string ("GAMEPULSE-Collector/0.1 (+url)" → "gamepulse-collector"). */
export function productToken(userAgent: string): string {
  return (userAgent.split('/')[0] ?? userAgent).trim().toLowerCase();
}

export function isPathAllowed(rules: RobotsRules, userAgent: string, path: string): boolean {
  const token = productToken(userAgent);
  const specific = rules.groups.filter((group) =>
    group.agents.some((agent) => agent !== '*' && token.includes(agent)),
  );
  const applicable =
    specific.length > 0 ? specific : rules.groups.filter((group) => group.agents.includes('*'));
  const matches = applicable
    .flatMap((group) => group.rules)
    .filter((rule) => patternToRegExp(rule.pattern).test(path))
    .sort((a, b) => b.pattern.length - a.pattern.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}

interface CacheEntry {
  rules: RobotsRules | 'allow-all' | 'disallow-all';
  expiresAt: number;
}

export class RobotsCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly transport: HttpTransport,
    private readonly clock: () => number = Date.now,
    private readonly ttlMs = 6 * 60 * 60 * 1000,
  ) {}

  async isAllowed(url: string, userAgent: string): Promise<boolean> {
    const target = new URL(url);
    const origin = target.origin;
    let entry = this.entries.get(origin);
    if (!entry || entry.expiresAt < this.clock()) {
      entry = { rules: await this.load(origin, userAgent), expiresAt: this.clock() + this.ttlMs };
      this.entries.set(origin, entry);
    }
    if (entry.rules === 'allow-all') return true;
    if (entry.rules === 'disallow-all') return false;
    return isPathAllowed(entry.rules, userAgent, `${target.pathname}${target.search}`);
  }

  private async load(origin: string, userAgent: string): Promise<CacheEntry['rules']> {
    try {
      const response = await this.transport.send({
        url: `${origin}/robots.txt`,
        method: 'GET',
        headers: { 'user-agent': userAgent, accept: 'text/plain' },
        timeoutMs: 10_000,
      });
      if (response.status >= 500 || response.status === 429) return 'disallow-all';
      if (response.status >= 400) return 'allow-all';
      return parseRobotsTxt(response.body);
    } catch {
      return 'disallow-all';
    }
  }
}
