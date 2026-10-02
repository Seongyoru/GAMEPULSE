/**
 * Parse-result cache: identical input + parser + version never triggers a second (paid) call.
 */
import { createHash } from 'node:crypto';
import { stableStringify, type JsonValue } from '@gamepulse/domain';
import { aiExtractionSchema } from './schema';
import type { AIParser, ParserInput, ParserOutput } from './types';

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export interface ParseCacheStore {
  find(
    inputHash: string,
    parserId: string,
    parserVersion: string,
  ): Promise<{ output: JsonValue | null } | null>;
  save(entry: {
    inputHash: string;
    parserId: string;
    parserVersion: string;
    output: JsonValue;
    model: string | null;
    usage: JsonValue | null;
  }): Promise<void>;
}

export function parserInputHash(input: ParserInput): string {
  return sha256Hex(
    stableStringify({
      task: input.task,
      gameId: input.gameId,
      text: input.text,
      title: input.title,
      locale: input.sourceLocale,
      defaultTimezone: input.defaultTimezone,
      serverTimezone: input.serverTimezone,
    }),
  );
}

export class CachedParser implements AIParser {
  readonly id: string;
  readonly version: string;
  readonly kind: AIParser['kind'];

  constructor(
    private readonly inner: AIParser,
    private readonly cache: ParseCacheStore,
  ) {
    this.id = inner.id;
    this.version = inner.version;
    this.kind = inner.kind;
  }

  async parse(input: ParserInput): Promise<ParserOutput> {
    const inputHash = parserInputHash(input);
    const cached = await this.cache.find(inputHash, this.id, this.version);
    if (cached?.output) {
      const parsed = aiExtractionSchema.safeParse(cached.output);
      if (parsed.success) return { extraction: parsed.data, model: null, usage: { cached: true } };
    }
    const result = await this.inner.parse(input);
    await this.cache.save({
      inputHash,
      parserId: this.id,
      parserVersion: this.version,
      output: result.extraction,
      model: result.model,
      usage: result.usage,
    });
    return result;
  }
}
