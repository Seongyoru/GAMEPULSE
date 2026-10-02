/**
 * GAMEPULSE operator CLI (run from the repository root):
 *
 *   pnpm seed [--games lol,genshin] [--dry-run]       sync registry + ingest fixture feeds
 *   pnpm seed --registry-only                         sync games/sources/reset rules only (production)
 *   pnpm ingest --adapter <id> [--mode live] [--force] [--dry-run]
 *   pnpm ingest --all [--mode fixture]
 *   pnpm ingest:manual <file.json> [--dry-run]         administrator fallback ingestion
 *   pnpm ingest:text <file> --game <id> --url <official URL> [--task EVENT] [--title ..]
 *       [--published <ISO>] [--default-zone Asia/Seoul]  structure an official notice's text
 *       with the configured parser (AI_PARSER)
 *   pnpm health:sources [--adapter <id>] [--mode live] source health checks
 *   pnpm runs [--limit 20]                            recent ingestion runs
 *   pnpm cli prune [--days 30]                         drop stored raw text older than N days
 */
import { parseArgs } from 'node:util';
import {
  createAdapterContext,
  listAdapterDefinitions,
  ManualFileAdapter,
  ManualTextAdapter,
  readManualFileGame,
  type AdapterHealth,
} from '@gamepulse/collectors';
import { fixturesAllowed } from '@gamepulse/config';
import { COLLECTOR_MODES, isValidTimeZone, type CollectorMode } from '@gamepulse/domain';
import { PARSE_TASKS, type ParseTask } from '@gamepulse/parsers';
import {
  ingestFixtures,
  runIngestion,
  syncRegistry,
  type IngestionReport,
} from '@gamepulse/ingestion';
import { AdapterSelectionError, resolveAdapter, runAdapter } from './jobs';
import { createRuntime, type Runtime } from './runtime';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    adapter: { type: 'string' },
    all: { type: 'boolean', default: false },
    mode: { type: 'string' },
    games: { type: 'string' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    limit: { type: 'string' },
    days: { type: 'string' },
    'registry-only': { type: 'boolean', default: false },
    game: { type: 'string' },
    url: { type: 'string' },
    task: { type: 'string' },
    title: { type: 'string' },
    published: { type: 'string' },
    'default-zone': { type: 'string' },
  },
});

const [command, ...rest] = positionals;

function parseMode(value: string | undefined, fallback: CollectorMode): CollectorMode {
  if (value === undefined) return fallback;
  if (!(COLLECTOR_MODES as readonly string[]).includes(value)) {
    throw new AdapterSelectionError(`--mode must be one of ${COLLECTOR_MODES.join(', ')}`);
  }
  return value as CollectorMode;
}

function printReport(report: IngestionReport): void {
  const c = report.counters;
  const line =
    `${report.status.padEnd(14)} ${report.adapterId.padEnd(26)} discovered=${c.discovered} fetched=${c.fetched} ` +
    `new=${c.new} updated=${c.updated} unchanged=${c.unchanged} skipped=${c.skipped} failed=${c.failed} (${report.durationMs} ms)`;
  console.log(line);
  for (const error of report.errors)
    console.log(`    ✗ ${error.stage} ${error.url ?? ''}: ${error.message}`);
  for (const warning of report.warnings) console.log(`    ! ${warning}`);
}

function printReports(reports: IngestionReport[]): boolean {
  if (values.json) console.log(JSON.stringify(reports, null, 2));
  else reports.forEach(printReport);
  return reports.every(
    (report) => report.status === 'SUCCEEDED' || report.status === 'SKIPPED_LOCKED',
  );
}

async function seed(runtime: Runtime): Promise<boolean> {
  const registryOnly = values['registry-only'];
  if (!registryOnly && !fixturesAllowed(runtime.env)) {
    console.error(
      'Refusing to ingest synthetic fixtures in production. Use `pnpm seed --registry-only` to sync the registry.',
    );
    return false;
  }
  const sync = await syncRegistry(runtime.store);
  console.log(
    `registry: games +${sync.games.created}/~${sync.games.updated}, sources +${sync.sources.created}/~${sync.sources.updated}, ` +
      `reset rules +${sync.resetRules.created}/~${sync.resetRules.updated}`,
  );
  if (registryOnly) return true;
  const gameIds = values.games
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const context = createAdapterContext({
    mode: 'fixture',
    env: runtime.env,
    logger: runtime.logger,
  });
  console.log(`fixture anchor: ${context.fixtureAnchor.toISOString()}`);
  const reports = await ingestFixtures({
    store: runtime.store,
    context,
    logger: runtime.logger,
    errorReporter: runtime.errorReporter,
    trigger: 'SEED',
    force: values.force,
    ...(gameIds ? { gameIds } : {}),
  });
  return printReports(reports);
}

async function ingest(runtime: Runtime): Promise<boolean> {
  const mode = parseMode(values.mode, runtime.env.COLLECTOR_MODE);
  await syncRegistry(runtime.store);
  const adapterIds = values.all
    ? listAdapterDefinitions({ mode }).map((definition) => definition.id)
    : values.adapter
      ? [values.adapter]
      : [];
  if (adapterIds.length === 0) throw new AdapterSelectionError('Pass --adapter <id> or --all');
  const reports: IngestionReport[] = [];
  for (const adapterId of adapterIds) {
    reports.push(
      await runAdapter(runtime, { adapterId, mode, trigger: 'CLI', force: values.force }),
    );
  }
  return printReports(reports);
}

async function ingestManual(runtime: Runtime): Promise<boolean> {
  const file = rest[0];
  if (!file) throw new AdapterSelectionError('Usage: pnpm ingest:manual <file.json>');
  const gameId = await readManualFileGame(file);
  await syncRegistry(runtime.store);
  const adapter = new ManualFileAdapter(gameId, file, () => new Date());
  const report = await runIngestion(
    adapter,
    { store: runtime.store, logger: runtime.logger, errorReporter: runtime.errorReporter },
    { trigger: 'MANUAL', force: values.force },
  );
  return printReports([report]);
}

async function ingestText(runtime: Runtime): Promise<boolean> {
  const file = rest[0];
  if (!file || !values.game || !values.url) {
    throw new AdapterSelectionError(
      'Usage: pnpm ingest:text <file.txt|file.html> --game <id> --url <official notice URL> [--task EVENT|PATCH|MAINTENANCE|REWARD|CLASSIFY] [--title ..] [--published <ISO>] [--default-zone <zone>]',
    );
  }
  const task = values.task ?? 'CLASSIFY';
  if (!(PARSE_TASKS as readonly string[]).includes(task)) {
    throw new AdapterSelectionError(`--task must be one of ${PARSE_TASKS.join(', ')}`);
  }
  if (values['default-zone'] && !isValidTimeZone(values['default-zone'])) {
    throw new AdapterSelectionError(
      `--default-zone ${values['default-zone']} is not a valid time zone`,
    );
  }
  await syncRegistry(runtime.store);
  const adapter = new ManualTextAdapter({
    gameId: values.game,
    filePath: file,
    url: values.url,
    task: task as ParseTask,
    title: values.title ?? null,
    publishedAt: values.published ? new Date(values.published).toISOString() : null,
    defaultTimezone: values['default-zone'] ?? null,
    parser: runtime.parser(),
    clock: () => new Date(),
  });
  const report = await runIngestion(
    adapter,
    { store: runtime.store, logger: runtime.logger, errorReporter: runtime.errorReporter },
    { trigger: 'MANUAL', force: values.force },
  );
  return printReports([report]);
}

async function health(runtime: Runtime): Promise<boolean> {
  const mode = parseMode(values.mode, runtime.env.COLLECTOR_MODE);
  const definitions = values.adapter
    ? [resolveAdapter(values.adapter, mode)]
    : listAdapterDefinitions({ mode });
  const context = createAdapterContext({ mode, env: runtime.env, logger: runtime.logger });
  const results: AdapterHealth[] = [];
  for (const definition of definitions) {
    results.push(await definition.create(context).healthCheck());
  }
  if (values.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      console.log(`${result.status.padEnd(10)} ${result.adapterId}`);
      for (const check of result.checks)
        console.log(`    ${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`);
    }
  }
  return results.every((result) => result.status === 'HEALTHY' || result.status === 'DISABLED');
}

async function runs(runtime: Runtime): Promise<boolean> {
  const list = await runtime.store.listRuns(Number(values.limit ?? 20));
  if (values.json) {
    console.log(JSON.stringify(list, null, 2));
    return true;
  }
  for (const run of list) {
    const c = run.counters;
    console.log(
      `${run.startedAt}  ${run.status.padEnd(9)} ${run.adapterId.padEnd(26)} ${run.trigger.padEnd(8)} ` +
        `new=${c.new} updated=${c.updated} unchanged=${c.unchanged} failed=${c.failed}${run.error ? `  error=${run.error.split('\n')[0]}` : ''}`,
    );
  }
  return true;
}

async function prune(runtime: Runtime): Promise<boolean> {
  const days = Number(values.days ?? runtime.env.RAW_TEXT_RETENTION_DAYS);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const pruned = await runtime.store.pruneRawText(cutoff);
  console.log(`pruned raw text of ${pruned} documents fetched before ${cutoff}`);
  return true;
}

const COMMANDS: Record<string, (runtime: Runtime) => Promise<boolean>> = {
  seed,
  ingest,
  'ingest-manual': ingestManual,
  'ingest-text': ingestText,
  health,
  runs,
  prune,
};

async function main(): Promise<number> {
  const handler = command ? COMMANDS[command] : undefined;
  if (!handler) {
    console.error(`Usage: cli <${Object.keys(COMMANDS).join('|')}> [options]`);
    return 2;
  }
  const needsStore = command !== 'health';
  const runtime = createRuntime({ dryRun: values['dry-run'] || !needsStore, logFormat: 'pretty' });
  try {
    return (await handler(runtime)) ? 0 : 1;
  } finally {
    await runtime.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof AdapterSelectionError ? error.message : error);
    process.exit(1);
  });
