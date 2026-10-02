/**
 * Parser selection from the environment (AI_PARSER) with a store-backed parse cache, so an
 * unchanged document never triggers a second (paid) AI call.
 */
import { EnvError, type ServerEnv } from '@gamepulse/config';
import type { IngestionStore } from '@gamepulse/domain';
import {
  CachedParser,
  ClaudeParser,
  MockParser,
  RuleBasedParser,
  type AIParser,
  type ParseCacheStore,
} from '@gamepulse/parsers';

export function storeParseCache(
  store: IngestionStore,
  clock: () => Date = () => new Date(),
): ParseCacheStore {
  return {
    find: (inputHash, parserId, parserVersion) =>
      store.findParseResult(inputHash, parserId, parserVersion),
    save: (entry) =>
      store.insertParseResult({
        rawDocumentId: null,
        parserId: entry.parserId,
        parserVersion: entry.parserVersion,
        inputHash: entry.inputHash,
        status: 'SUCCEEDED',
        output: entry.output,
        error: null,
        model: entry.model,
        usage: entry.usage,
        createdAt: clock().toISOString(),
      }),
  };
}

export function createParser(env: ServerEnv, store: IngestionStore | null): AIParser {
  switch (env.AI_PARSER) {
    case 'mock':
      return new MockParser();
    case 'rule-based':
      return new RuleBasedParser();
    case 'claude': {
      if (!env.ANTHROPIC_API_KEY) {
        throw new EnvError('AI_PARSER=claude requires ANTHROPIC_API_KEY (server-side only)');
      }
      const claude = new ClaudeParser({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.AI_MODEL,
        effort: env.AI_EFFORT === 'none' ? null : env.AI_EFFORT,
        maxInputChars: env.AI_MAX_INPUT_CHARS,
        serverFallback: env.AI_SERVER_FALLBACK,
      });
      return store ? new CachedParser(claude, storeParseCache(store)) : claude;
    }
  }
}
