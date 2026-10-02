/**
 * Reset rules are recurring definitions — never materialized as daily rows.
 * Occurrences are computed by the reset engine (src/reset).
 */
import { z } from 'zod';
import { RESET_FREQUENCIES, VERIFICATION_STATES } from '../enums';
import { isValidTimeZone } from '../time/zone';

export const resetRuleDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
    gameId: z.string().min(1).max(40),
    /** Display name in the source locale, e.g. "주간 초기화". */
    name: z.string().min(1).max(80),
    frequency: z.enum(RESET_FREQUENCIES),
    timezone: z.string().refine(isValidTimeZone, { message: 'Invalid time zone' }),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    /** ISO weekday 1 (Mon) … 7 (Sun); required for WEEKLY. */
    dayOfWeek: z.number().int().min(1).max(7).nullable(),
    /** 1-31, or -1 for the last day of the month; required for MONTHLY. */
    dayOfMonth: z.number().int().min(-1).max(31).refine((d) => d !== 0).nullable(),
    /** RFC 5545 RRULE subset for CUSTOM_RRULE (see reset/rrule.ts). */
    rrule: z.string().min(1).max(300).nullable(),
    /** DTSTART anchor (ISO) for interval-based rules, e.g. bi-weekly resets. */
    anchor: z.iso.datetime({ offset: true }).nullable(),
    region: z.string().min(1).max(32).nullable(),
    /** Shown in the game's dashboard snapshot. */
    isPrimary: z.boolean(),
    verification: z.enum(VERIFICATION_STATES),
    isSynthetic: z.boolean(),
    /** Where the schedule is documented (required for verified rules). */
    sourceUrl: z.url().nullable(),
    notes: z.string().min(1).max(300).nullable(),
  })
  .superRefine((rule, ctx) => {
    if (rule.frequency === 'WEEKLY' && rule.dayOfWeek === null) {
      ctx.addIssue({ code: 'custom', path: ['dayOfWeek'], message: 'WEEKLY rules need dayOfWeek' });
    }
    if (rule.frequency === 'MONTHLY' && rule.dayOfMonth === null) {
      ctx.addIssue({ code: 'custom', path: ['dayOfMonth'], message: 'MONTHLY rules need dayOfMonth' });
    }
    if (rule.frequency === 'CUSTOM_RRULE' && rule.rrule === null) {
      ctx.addIssue({ code: 'custom', path: ['rrule'], message: 'CUSTOM_RRULE rules need rrule' });
    }
    if (
      (rule.verification === 'AUTO_VERIFIED' || rule.verification === 'MANUAL_VERIFIED') &&
      rule.sourceUrl === null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceUrl'],
        message: 'Verified reset rules must cite the source documenting the schedule',
      });
    }
  });

export type ResetRuleDefinition = z.infer<typeof resetRuleDefinitionSchema>;
