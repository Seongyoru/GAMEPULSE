/**
 * Strict schema of stored preferences (server-side validation, tests). Browser code uses the
 * Zod-free sanitizer in ./preferences instead.
 */
import { z } from 'zod';
import {
  MAX_DISMISSED,
  MAX_SELECTED_GAMES,
  PREFERENCES_VERSION,
  type UserPreferences,
} from './preferences';

export const userPreferencesSchema: z.ZodType<UserPreferences> = z.object({
  version: z.literal(PREFERENCES_VERSION),
  selectedGameIds: z.array(z.string()).max(MAX_SELECTED_GAMES),
  timezone: z.string(),
  locale: z.string(),
  dismissedPulseIds: z.array(z.string()).max(MAX_DISMISSED),
  configuredAt: z.iso.datetime({ offset: true }).nullable(),
});
