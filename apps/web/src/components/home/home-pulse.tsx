'use client';

import {
  buildGameSnapshot,
  buildPulseStream,
  buildToday,
  listPublicGames,
  sourceAttributions,
  TODAY_SECTIONS,
  type PulseItem,
  type PulseMoment,
  type ResetRuleDefinition,
} from '@gamepulse/domain';
import { GameMark, SectionHeader, SourceAttributionNote, Timeline } from '@gamepulse/ui';
import { useNow } from '@gamepulse/ui/client';
import { Clock3, Flame, Gamepad2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { ko } from '@/lib/i18n';
import { useEffectiveGameIds } from '@/lib/preferences';
import { formatInstant, gameViewById } from '@/lib/present';
import { PulseItemCard } from '../pulse-item-card';
import { GameSnapshotCard } from '../today/game-snapshot-card';

const MOMENT_LABEL: Readonly<Record<PulseMoment['kind'], string>> = {
  PATCH: '패치 적용',
  UPDATE: '업데이트',
  EVENT_START: '이벤트 시작',
  EVENT_ENDING: '이벤트 종료',
  REWARD: '보상 시작',
  REDEEM_CODE: '쿠폰 공개',
  MAINTENANCE: '점검',
  RESET: '초기화',
  BANNER_START: '픽업 시작',
  BANNER_END: '픽업 종료',
  ANNOUNCEMENT: '공지',
};

export function HomePulse({
  items,
  resets,
  generatedAt,
}: {
  items: PulseItem[];
  resets: ResetRuleDefinition[];
  generatedAt: string;
}) {
  const serverNow = Date.parse(generatedAt);
  const now = useNow('minute', serverNow);
  const { gameIds } = useEffectiveGameIds();
  const gameKey = gameIds.join(',');

  const highlights = useMemo(() => {
    const today = buildToday({ items, resets, now: new Date(now), gameIds: gameKey.split(',') });
    return TODAY_SECTIONS.filter((id) => id !== 'resets' && id !== 'upcoming')
      .flatMap((id) => today.sections[id])
      .filter((entry) => entry.kind === 'item')
      .slice(0, 8);
  }, [items, resets, now, gameKey]);

  const moments = useMemo(
    () =>
      buildPulseStream({
        items,
        resets,
        now: new Date(now),
        gameIds: gameKey.split(','),
        options: { pastWindowMs: 0, futureWindowMs: 48 * 3_600_000 },
      }).slice(0, 10),
    [items, resets, now, gameKey],
  );

  const snapshots = useMemo(
    () =>
      listPublicGames()
        .filter((game) => gameKey.split(',').includes(game.gameId))
        .map((game) =>
          buildGameSnapshot({ gameId: game.gameId, items, resets, now: new Date(now) }),
        ),
    [items, resets, now, gameKey],
  );

  return (
    <div data-mg-scope className="mt-12 space-y-12">
      <section aria-labelledby="home-happening">
        <SectionHeader
          id="home-happening"
          eyebrow={ko.home.happeningToday}
          title={ko.home.happeningTodayKo}
          icon={<Flame />}
          action={
            <Link href="/today" className="text-sm font-semibold text-muted hover:text-text">
              {ko.home.seeAll} →
            </Link>
          }
        />
        <div className="grid gap-2 md:grid-cols-2">
          {highlights.map((entry) =>
            entry.kind === 'item' ? (
              <PulseItemCard key={entry.item.id} item={entry.item} serverNow={serverNow} />
            ) : null,
          )}
        </div>
      </section>

      <section aria-labelledby="home-games">
        <SectionHeader
          id="home-games"
          eyebrow="GAMES"
          title={ko.home.supportedGames}
          icon={<Gamepad2 />}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshots.map((snapshot) => (
            <GameSnapshotCard key={snapshot.gameId} snapshot={snapshot} />
          ))}
        </div>
      </section>

      {moments.length > 0 ? (
        <section aria-labelledby="home-upcoming">
          <SectionHeader
            id="home-upcoming"
            eyebrow="NEXT 48H"
            title={ko.home.comingUp}
            icon={<Clock3 />}
          />
          <Timeline
            entries={moments.map((moment) => {
              const game = gameViewById(moment.gameId);
              return {
                id: moment.id,
                gameId: moment.gameId,
                accent: game.accent,
                time: formatInstant(moment.at).slice(5),
                content: (
                  <span className="flex items-center gap-2 text-sm">
                    <GameMark gameId={moment.gameId} label={game.shortName} size="sm" />
                    <span className="sr-only">{game.shortName}</span>
                    <span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                      {MOMENT_LABEL[moment.kind]}
                    </span>
                    {moment.href ? (
                      <Link href={moment.href} className="font-medium text-text hover:underline">
                        {moment.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-text">{moment.title}</span>
                    )}
                  </span>
                ),
              };
            })}
          />
          <SourceAttributionNote
            attributions={sourceAttributions(
              moments.flatMap((moment) => (moment.item ? [moment.item] : [])),
            )}
            className="mt-2"
          />
        </section>
      ) : null}
    </div>
  );
}
