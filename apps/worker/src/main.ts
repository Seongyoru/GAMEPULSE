/**
 * GAMEPULSE ingestion worker: BullMQ consumer + job schedulers.
 *
 *   REDIS_URL, DATABASE_URL required. Scheduling can be disabled with INGEST_SCHEDULE_ENABLED=false
 *   (e.g. when an external cron enqueues jobs instead).
 */
import { syncRegistry } from '@gamepulse/ingestion';
import { Queue, Worker } from 'bullmq';
import { INGEST_QUEUE, ingestJobId, ingestJobSchema, runAdapter, type IngestJobData } from './jobs';
import { createRuntime } from './runtime';
import { planSchedule } from './scheduler';

const runtime = createRuntime({ logFormat: 'json' });
const { env, logger } = runtime;

if (!env.REDIS_URL) {
  logger.error(
    'REDIS_URL is not set; the worker needs Redis. Use `pnpm ingest` for one-off runs without Redis.',
  );
  process.exit(1);
}

const connection = { url: env.REDIS_URL, maxRetriesPerRequest: null };
const queue = new Queue<IngestJobData>(INGEST_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

const worker = new Worker<IngestJobData>(
  INGEST_QUEUE,
  async (job) => {
    const data = ingestJobSchema.parse(job.data);
    const report = await runAdapter(runtime, data);
    return { status: report.status, counters: report.counters, errors: report.errors.length };
  },
  { connection, concurrency: 2 },
);

worker.on('completed', (job, result: unknown) =>
  logger.info('job completed', { jobId: job.id, result }),
);
worker.on('failed', (job, error) => {
  logger.error('job failed', { jobId: job?.id, error });
  runtime.errorReporter.captureException(error, {
    tags: { queue: INGEST_QUEUE, jobId: String(job?.id) },
  });
});

await syncRegistry(runtime.store);

if (env.INGEST_SCHEDULE_ENABLED) {
  const { scheduled, skipped } = planSchedule(env);
  for (const entry of skipped)
    logger.info('adapter not scheduled', { adapter: entry.adapterId, reason: entry.reason });
  for (const { definition, mode, everyMinutes } of scheduled) {
    await queue.upsertJobScheduler(
      ingestJobId(definition.id),
      { every: everyMinutes * 60_000, immediately: true },
      {
        name: 'ingest',
        data: { adapterId: definition.id, mode, trigger: 'SCHEDULE', force: false },
      },
    );
    logger.info('adapter scheduled', { adapter: definition.id, mode, everyMinutes });
  }
}

logger.info('worker started', {
  queue: INGEST_QUEUE,
  store: runtime.storeKind,
  mode: env.COLLECTOR_MODE,
});

const shutdown = async (signal: string) => {
  logger.info('worker shutting down', { signal });
  await worker.close();
  await queue.close();
  await runtime.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
