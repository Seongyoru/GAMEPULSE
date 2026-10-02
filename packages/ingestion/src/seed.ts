/**
 * Registry sync and fixture ingestion helpers shared by `pnpm seed`, the worker and the web
 * app's fixture mode.
 */
import {
  listAdapterDefinitions,
  listSourceDefinitions,
  type AdapterContext,
} from '@gamepulse/collectors';
import {
  GAMES,
  RESET_RULES,
  type IngestionStore,
  type IngestionTrigger,
  type SyncCounts,
} from '@gamepulse/domain';
import type { ErrorReporter, Logger } from '@gamepulse/observability';
import { runIngestion, type IngestionReport } from './pipeline';

export interface RegistrySyncReport {
  games: SyncCounts;
  sources: SyncCounts;
  resetRules: SyncCounts;
}

/** Upserts games, sources and reset rules from code-reviewed configuration. */
export async function syncRegistry(
  store: IngestionStore,
  now: Date = new Date(),
): Promise<RegistrySyncReport> {
  const iso = now.toISOString();
  return {
    games: await store.syncGames(GAMES, iso),
    sources: await store.syncSources(listSourceDefinitions(), iso),
    resetRules: await store.syncResetRules(RESET_RULES, iso),
  };
}

/** Runs every fixture adapter (optionally for selected games) through the full pipeline. */
export async function ingestFixtures(input: {
  store: IngestionStore;
  context: AdapterContext;
  logger: Logger;
  trigger: IngestionTrigger;
  gameIds?: readonly string[];
  errorReporter?: ErrorReporter;
  force?: boolean;
}): Promise<IngestionReport[]> {
  const reports: IngestionReport[] = [];
  for (const definition of listAdapterDefinitions({ mode: 'fixture' })) {
    if (input.gameIds && !input.gameIds.includes(definition.gameId)) continue;
    const adapter = definition.create({ ...input.context, mode: 'fixture' });
    reports.push(
      await runIngestion(
        adapter,
        {
          store: input.store,
          logger: input.logger,
          clock: input.context.clock,
          ...(input.errorReporter ? { errorReporter: input.errorReporter } : {}),
        },
        { trigger: input.trigger, ...(input.force ? { force: true } : {}) },
      ),
    );
  }
  return reports;
}
