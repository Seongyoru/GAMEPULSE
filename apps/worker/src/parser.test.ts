import { EnvError, parseServerEnv } from '@gamepulse/config';
import { InMemoryContentStore } from '@gamepulse/database/memory';
import { describe, expect, it } from 'vitest';
import { createParser } from './parser';

describe('createParser', () => {
  it('defaults to the deterministic rule-based parser', () => {
    expect(createParser(parseServerEnv({}), null)).toMatchObject({
      id: 'rule-based',
      kind: 'deterministic',
    });
  });

  it('requires a server-side key for Claude and wraps it in the parse cache', () => {
    expect(() => createParser(parseServerEnv({ AI_PARSER: 'claude' }), null)).toThrow(EnvError);
    const parser = createParser(
      parseServerEnv({ AI_PARSER: 'claude', ANTHROPIC_API_KEY: 'sk-ant-test', AI_EFFORT: 'low' }),
      new InMemoryContentStore(),
    );
    expect(parser).toMatchObject({
      id: 'claude',
      kind: 'ai',
      version: 'claude-1:claude-opus-5-5:low',
    });
    expect(parser.constructor.name).toBe('CachedParser');
  });
});
