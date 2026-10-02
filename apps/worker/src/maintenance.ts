/**
 * Data-retention maintenance, run daily by the worker and on demand by `pnpm cli prune`:
 *  - raw document text older than RAW_TEXT_RETENTION_DAYS is dropped (hashes/metadata kept);
 *  - sources with a terms-imposed TTL (`dataRetentionDays`, e.g. NEXON Open API) lose the
 *    content and raw documents no run has confirmed within that window.
 */
import { listSourceDefinitions } from '@gamepulse/collectors';
import { DAY_MS, type IngestionStore } from '@gamepulse/domain';

export const MAINTENANCE_QUEUE = 'gamepulse-maintenance';

export interface MaintenanceReport {
  prunedRawText: number;
  expired: Array<{
    sourceId: string;
    retentionDays: number;
    content: number;
    rawDocuments: number;
  }>;
}

export async function runMaintenance(
  store: IngestionStore,
  options: { rawTextRetentionDays: number; now?: Date },
): Promise<MaintenanceReport> {
  const now = (options.now ?? new Date()).getTime();
  const daysAgo = (days: number) => new Date(now - days * DAY_MS).toISOString();
  const prunedRawText = await store.pruneRawText(daysAgo(options.rawTextRetentionDays));
  const expired: MaintenanceReport['expired'] = [];
  for (const source of listSourceDefinitions()) {
    if (source.dataRetentionDays === null) continue;
    const result = await store.expireSourceData(source.id, daysAgo(source.dataRetentionDays));
    expired.push({ sourceId: source.id, retentionDays: source.dataRetentionDays, ...result });
  }
  return { prunedRawText, expired };
}
