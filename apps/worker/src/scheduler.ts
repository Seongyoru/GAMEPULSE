/**
 * Decides which adapters the worker schedules. Only sources whose terms review allows
 * automated collection (collectorStatus ENABLED) and whose credentials are configured run
 * live. Fixture adapters run hourly in fixture mode to keep development data current; fixture
 * and mock modes are refused in production (synthetic data must never reach real users).
 * Hidden (INACTIVE) games are never scheduled; operators can still ingest them explicitly.
 */
import { listAdapterDefinitions, type AdapterDefinition } from '@gamepulse/collectors';
import { fixturesAllowed, type ServerEnv } from '@gamepulse/config';
import { isPublicGameId, type CollectorMode } from '@gamepulse/domain';

export interface ScheduledAdapter {
  definition: AdapterDefinition;
  mode: CollectorMode;
  everyMinutes: number;
}

export interface SkippedAdapter {
  adapterId: string;
  reason: string;
}

const FIXTURE_REFRESH_MINUTES = 60;

export function planSchedule(
  env: ServerEnv,
  options: { isGameCollected?: (gameId: string) => boolean } = {},
): {
  scheduled: ScheduledAdapter[];
  skipped: SkippedAdapter[];
} {
  const scheduled: ScheduledAdapter[] = [];
  const skipped: SkippedAdapter[] = [];
  const mode = env.COLLECTOR_MODE;
  const syntheticRefused = mode !== 'live' && !fixturesAllowed(env);
  const isGameCollected = options.isGameCollected ?? isPublicGameId;

  for (const definition of listAdapterDefinitions()) {
    if (syntheticRefused) {
      skipped.push({ adapterId: definition.id, reason: `${mode} mode is refused in production` });
      continue;
    }
    if (!isGameCollected(definition.gameId)) {
      skipped.push({ adapterId: definition.id, reason: 'game is hidden (INACTIVE)' });
      continue;
    }
    if (!definition.supportedModes.includes(mode)) {
      skipped.push({ adapterId: definition.id, reason: `does not support ${mode} mode` });
      continue;
    }
    if (mode === 'fixture') {
      scheduled.push({ definition, mode, everyMinutes: FIXTURE_REFRESH_MINUTES });
      continue;
    }
    if (mode === 'live' && definition.source.collectorStatus !== 'ENABLED') {
      skipped.push({
        adapterId: definition.id,
        reason: `source is ${definition.source.collectorStatus}`,
      });
      continue;
    }
    const missing = definition.credentials.filter((name) => !env[name]);
    if (mode === 'live' && missing.length > 0) {
      skipped.push({
        adapterId: definition.id,
        reason: `missing credentials: ${missing.join(', ')}`,
      });
      continue;
    }
    if (definition.scheduleEveryMinutes === null) {
      skipped.push({ adapterId: definition.id, reason: 'no schedule defined' });
      continue;
    }
    scheduled.push({ definition, mode, everyMinutes: definition.scheduleEveryMinutes });
  }
  return { scheduled, skipped };
}
