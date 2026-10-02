/**
 * SourceDefinition — provenance and policy metadata for every place GAMEPULSE reads from.
 * Synced to the `sources` table; documented in docs/DATA_SOURCES.md.
 */
import { z } from 'zod';
import { COLLECTOR_STATUSES, CONTENT_TYPES, SOURCE_AUTHENTICATION, SOURCE_TYPES } from '../enums';

export const sourceDefinitionSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  gameId: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  type: z.enum(SOURCE_TYPES),
  isOfficial: z.boolean(),
  homepageUrl: z.url({ protocol: /^https?$/ }),
  /** Hosts allowed in item-level sourceUrl values for this source. */
  allowedHosts: z.array(z.string().min(1)).min(1),
  authentication: z.enum(SOURCE_AUTHENTICATION),
  /** Documented rate limit, human-readable. Null when unknown. */
  rateLimit: z.string().min(1).nullable(),
  contentTypes: z.array(z.enum(CONTENT_TYPES)).min(1),
  /** Whether automated collection is permitted. Anything but ENABLED blocks scheduling. */
  collectorStatus: z.enum(COLLECTOR_STATUSES),
  termsUrl: z.url().nullable(),
  /** ISO date (YYYY-MM-DD) of the last terms/robots review. */
  termsReviewedAt: z.iso.date().nullable(),
  robotsPolicy: z.string().min(1).nullable(),
  /** Attribution text that must be displayed wherever this source's data appears. */
  attribution: z.string().min(1).nullable(),
  /** Maximum days data from this source may be retained (terms-imposed TTL); null = no stated limit. */
  dataRetentionDays: z.number().int().positive().nullable(),
  notes: z.string().min(1).nullable(),
});

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;
