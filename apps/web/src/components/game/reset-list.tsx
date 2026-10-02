'use client';

import { nextOccurrence, type ResetRuleDefinition } from '@gamepulse/domain';
import { EmptyState } from '@gamepulse/ui';
import { useNow } from '@gamepulse/ui/client';
import { useMemo } from 'react';
import { ko } from '@/lib/i18n';
import { ResetRuleTimer } from '../reset-rule-timer';

/** Reset rules ordered by their next occurrence, recomputed every minute on the client. */
export function ResetList({
  resets,
  generatedAt,
  limit,
  detailed = false,
}: {
  resets: ResetRuleDefinition[];
  generatedAt: string;
  limit?: number;
  detailed?: boolean;
}) {
  const now = useNow('minute', Date.parse(generatedAt));
  const entries = useMemo(
    () =>
      resets
        .map((rule) => ({ rule, next: nextOccurrence(rule, new Date(now)) }))
        .filter((entry): entry is { rule: ResetRuleDefinition; next: Date } => entry.next !== null)
        .sort((a, b) => a.next.getTime() - b.next.getTime()),
    [resets, now],
  );
  if (entries.length === 0) return <EmptyState title={ko.game.noItems} />;
  return (
    <ul className="grid gap-2" data-testid="reset-list">
      {entries.slice(0, limit).map(({ rule, next }) => (
        <li key={rule.id}>
          <ResetRuleTimer rule={rule} nextAt={next.toISOString()} showGame={false} />
          {detailed && (rule.notes || rule.sourceUrl) ? (
            <p className="px-3 pt-1 text-xs text-muted">
              {rule.notes}
              {rule.sourceUrl ? (
                <>
                  {rule.notes ? ' · ' : null}
                  <a
                    href={rule.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-source-link
                    className="underline hover:text-text"
                  >
                    {ko.resets.sourceLink} ↗
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
