/**
 * Adapter registry. Adding a source = adding an AdapterDefinition here (and its id to the
 * game's `adapters` list in the domain registry). Nothing else branches on game ids.
 */
import { GAMES, listGames, type CollectorMode, type SourceDefinition } from '@gamepulse/domain';
import { fixtureAdapterDefinition } from './fixtures/fixture-adapter';
import { manualSourceFor } from './sources';
import type { AdapterDefinition } from './types';

const DEFINITIONS: readonly AdapterDefinition[] = [...GAMES.map(fixtureAdapterDefinition)];

const BY_ID = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));

export function listAdapterDefinitions(
  filter: { gameId?: string; mode?: CollectorMode } = {},
): AdapterDefinition[] {
  return DEFINITIONS.filter(
    (definition) =>
      (filter.gameId === undefined || definition.gameId === filter.gameId) &&
      (filter.mode === undefined || definition.supportedModes.includes(filter.mode)),
  );
}

export function getAdapterDefinition(id: string): AdapterDefinition | undefined {
  return BY_ID.get(id);
}

/** Every source GAMEPULSE knows about (adapter sources + manual input per game). */
export function listSourceDefinitions(): SourceDefinition[] {
  const sources = new Map<string, SourceDefinition>();
  for (const definition of DEFINITIONS) sources.set(definition.source.id, definition.source);
  for (const game of listGames()) {
    const manual = manualSourceFor(game);
    sources.set(manual.id, manual);
  }
  return [...sources.values()].sort((a, b) => a.id.localeCompare(b.id));
}
