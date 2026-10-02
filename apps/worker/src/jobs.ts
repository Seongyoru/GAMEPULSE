/**
 * Ingestion jobs. MVP combines the pipeline stages in one job per adapter run; stage
 * boundaries remain explicit inside @gamepulse/ingestion and in the logs.
 */
import {
  createAdapterContext,
  getAdapterDefinition,
  listAdapterDefinitions,
  type AdapterDefinition,
} from '@gamepulse/collectors';
import { fixturesAllowed } from '@gamepulse/config';
import { COLLECTOR_MODES, type CollectorMode } from '@gamepulse/domain';
import { runIngestion, type IngestionReport } from '@gamepulse/ingestion';
import { z } from 'zod';
import type { Runtime } from './runtime';

export const INGEST_QUEUE = 'gamepulse-ingest';

export const ingestJobSchema = z.object({
  adapterId: z.string().min(1),
  mode: z.enum(COLLECTOR_MODES),
  trigger: z.enum(['SCHEDULE', 'CLI', 'MANUAL']),
  force: z.boolean().default(false),
});
export type IngestJobData = z.infer<typeof ingestJobSchema>;

/** Stable job id: BullMQ refuses a second job with the same id while one is pending. */
export function ingestJobId(adapterId: string): string {
  return `ingest:${adapterId}`;
}

export class AdapterSelectionError extends Error {
  override name = 'AdapterSelectionError';
}

export function resolveAdapter(adapterId: string, mode: CollectorMode): AdapterDefinition {
  const definition = getAdapterDefinition(adapterId);
  if (!definition) {
    const known = listAdapterDefinitions()
      .map((d) => d.id)
      .join(', ');
    throw new AdapterSelectionError(`Unknown adapter "${adapterId}". Known adapters: ${known}`);
  }
  if (!definition.supportedModes.includes(mode)) {
    throw new AdapterSelectionError(
      `Adapter "${adapterId}" does not support mode "${mode}" (supports: ${definition.supportedModes.join(', ')})`,
    );
  }
  return definition;
}

export async function runAdapter(runtime: Runtime, job: IngestJobData): Promise<IngestionReport> {
  const definition = resolveAdapter(job.adapterId, job.mode);
  if (job.mode !== 'live' && !fixturesAllowed(runtime.env)) {
    throw new AdapterSelectionError(
      `Refusing ${job.mode}-mode ingestion in production: it writes synthetic data (GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION=true only for previews)`,
    );
  }
  if (job.mode === 'live') {
    const missing = definition.credentials.filter((name) => !runtime.env[name]);
    if (missing.length > 0)
      throw new AdapterSelectionError(
        `Adapter "${definition.id}" needs ${missing.join(', ')} for live mode`,
      );
    if (definition.source.collectorStatus !== 'ENABLED') {
      throw new AdapterSelectionError(
        `Source "${definition.source.id}" is ${definition.source.collectorStatus}; automated live collection is not permitted (see docs/DATA_SOURCES.md)`,
      );
    }
  }
  const context = createAdapterContext({
    mode: job.mode,
    env: runtime.env,
    logger: runtime.logger,
  });
  return runIngestion(
    definition.create(context),
    { store: runtime.store, logger: runtime.logger, errorReporter: runtime.errorReporter },
    { trigger: job.trigger, force: job.force },
  );
}
