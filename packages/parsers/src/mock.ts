/**
 * MockParser — the only parser automated tests may use. Deterministic, offline, free.
 * It simulates an AI parser (kind "ai"), so validation applies AI evidence rules to its output.
 */
import { aiExtractionSchema, type AiExtraction } from './schema';
import type { AIParser, ParserInput, ParserOutput } from './types';

export type MockResponder = (input: ParserInput) => AiExtraction | Promise<AiExtraction>;

export class MockParser implements AIParser {
  readonly id = 'mock';
  readonly kind = 'ai' as const;
  readonly calls: ParserInput[] = [];

  constructor(
    private readonly responder: MockResponder = () => ({ items: [] }),
    readonly version = 'mock-1',
  ) {}

  async parse(input: ParserInput): Promise<ParserOutput> {
    this.calls.push(input);
    const extraction = aiExtractionSchema.parse(await this.responder(input));
    return { extraction, model: 'mock-model', usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
