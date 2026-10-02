import { listGames, sourceDefinitionSchema } from '@gamepulse/domain';
import { describe, expect, it } from 'vitest';
import { getAdapterDefinition, listAdapterDefinitions, listSourceDefinitions } from './registry';

describe('adapter registry', () => {
  it('matches the adapter ids declared by each game', () => {
    for (const game of listGames()) {
      const declared = [...game.adapters].sort();
      const registered = listAdapterDefinitions({ gameId: game.gameId })
        .map((definition) => definition.id)
        .sort();
      expect(registered, game.gameId).toEqual(declared);
      for (const id of declared) expect(getAdapterDefinition(id)?.gameId).toBe(game.gameId);
    }
  });

  it('only schedules live collection for sources whose terms review allows it', () => {
    for (const definition of listAdapterDefinitions({ mode: 'live' })) {
      expect(definition.source.type).not.toBe('FIXTURE');
      expect(definition.source.termsReviewedAt, definition.id).not.toBeNull();
      expect(definition.source.termsUrl, definition.id).not.toBeNull();
    }
  });

  it('declares valid, unique sources including mock twins and manual input', () => {
    const sources = listSourceDefinitions();
    expect(new Set(sources.map((source) => source.id)).size).toBe(sources.length);
    for (const source of sources)
      expect(sourceDefinitionSchema.safeParse(source).success).toBe(true);
    const mock = sources.find((source) => source.id === 'lostark-openapi-mock');
    expect(mock).toMatchObject({ type: 'FIXTURE', collectorStatus: 'FIXTURE_ONLY' });
  });
});
