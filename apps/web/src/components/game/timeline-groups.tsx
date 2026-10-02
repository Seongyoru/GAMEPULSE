'use client';

import {
  groupByTimeline,
  TIMELINE_GROUPS,
  type PulseItem,
  type TimelineGroup,
} from '@gamepulse/domain';
import { EmptyState, SectionHeader } from '@gamepulse/ui';
import { useNow } from '@gamepulse/ui/client';
import { useMemo } from 'react';
import { ko } from '@/lib/i18n';
import { ContentItemCard } from '../event-item-card';

const GROUP_META: Readonly<Record<TimelineGroup, { eyebrow: string; title: string }>> = {
  current: { eyebrow: 'NOW', title: ko.game.current },
  upcoming: { eyebrow: 'UPCOMING', title: ko.game.upcoming },
  recent: { eyebrow: 'RECENT', title: ko.game.recent },
};

/** Current / upcoming / recent sections, regrouped on the client as time passes. */
export function TimelineGroups({
  items,
  generatedAt,
  recentLimit,
}: {
  items: PulseItem[];
  generatedAt: string;
  recentLimit?: number;
}) {
  const serverNow = Date.parse(generatedAt);
  const now = useNow('minute', serverNow);
  const groups = useMemo(
    () => groupByTimeline(items, now, recentLimit ? { recentLimit } : {}),
    [items, now, recentLimit],
  );

  if (TIMELINE_GROUPS.every((group) => groups[group].length === 0)) {
    return <EmptyState title={ko.game.noItems} />;
  }
  return (
    <div className="space-y-8">
      {TIMELINE_GROUPS.map((group) =>
        groups[group].length === 0 ? null : (
          <section key={group} aria-labelledby={`group-${group}`} data-testid={`group-${group}`}>
            <SectionHeader
              id={`group-${group}`}
              eyebrow={GROUP_META[group].eyebrow}
              title={GROUP_META[group].title}
              count={groups[group].length}
            />
            <div className="grid gap-2 md:grid-cols-2">
              {groups[group].map((item) => (
                <ContentItemCard key={item.id} item={item} serverNow={serverNow} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
