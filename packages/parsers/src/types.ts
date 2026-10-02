/**
 * Parser abstraction. AI is a transformation layer, never the source of truth: parsers turn an
 * official document into structured *candidates* that the validation engine then checks.
 */
import type { JsonValue } from '@gamepulse/domain';
import type { AiExtraction } from './schema';

export const PARSE_TASKS = ['EVENT', 'PATCH', 'MAINTENANCE', 'REWARD', 'CLASSIFY'] as const;
export type ParseTask = (typeof PARSE_TASKS)[number];

export interface ParserInput {
  task: ParseTask;
  gameId: string;
  sourceUrl: string;
  sourceLocale: string;
  /** Sanitized plain text of the official document. Never raw HTML. */
  text: string;
  title: string | null;
  publishedAt: string | null;
  /** Zone to assume when the text gives times without a label (from the source's policy). */
  defaultTimezone: string | null;
  /** Zone meant by "server time" for the game's default region. */
  serverTimezone: string | null;
}

export interface ParserOutput {
  extraction: AiExtraction;
  /** Model identifier for AI parsers; null for deterministic parsers. */
  model: string | null;
  usage: JsonValue | null;
}

export type ParserKindName = 'ai' | 'deterministic';

export interface AIParser {
  /** Stable parser id, e.g. "claude", "mock", "rule-based". */
  readonly id: string;
  /** Changes whenever prompt, schema or logic changes (invalidates cached results). */
  readonly version: string;
  readonly kind: ParserKindName;
  parse(input: ParserInput): Promise<ParserOutput>;
}

export class ParserError extends Error {
  override name = 'ParserError';
}
