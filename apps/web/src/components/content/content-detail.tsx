import {
  contentPath,
  requireGame,
  type ContentRecord,
  type ContentRouteFamily,
  type PatchChangeRecord,
} from '@gamepulse/domain';
import {
  AdSlot,
  Card,
  GameBadge,
  PatchChange,
  RewardBadge,
  SourceBadge,
  StatusChip,
  type AdSlotMode,
} from '@gamepulse/ui';
import { Countdown } from '@gamepulse/ui/client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ko } from '@/lib/i18n';
import {
  formatInstant,
  formatPeriod,
  gameView,
  typeLabel,
  VIEWER_TIMEZONE,
  zoneLabel,
} from '@/lib/present';
import { contentJsonLd, breadcrumbJsonLd } from '@/server/seo';
import { MyGamesToggle } from '../my-games/my-games-toggle';
import { LiveStatusChip } from '../pulse-item-card';
import { Breadcrumbs } from './breadcrumbs';
import { CopyCodeButton } from './copy-code';
import { JsonLdScript } from './json-ld';

const FAMILY_TAB: Readonly<Record<ContentRouteFamily, { name: string; tab: string }>> = {
  patches: { name: ko.game.tabs.patches, tab: 'patches' },
  events: { name: ko.game.tabs.events, tab: 'events' },
  rewards: { name: ko.game.tabs.rewards, tab: 'rewards' },
  notices: { name: ko.game.tabs.overview, tab: '' },
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-text">{children}</dd>
    </div>
  );
}

function groupChanges(changes: readonly PatchChangeRecord[]): Array<[string, PatchChangeRecord[]]> {
  const groups = new Map<string, PatchChangeRecord[]>();
  for (const change of changes)
    groups.set(change.targetType, [...(groups.get(change.targetType) ?? []), change]);
  return [...groups.entries()];
}

const TARGET_GROUP_LABEL: Record<string, string> = {
  CHAMPION: '챔피언',
  ITEM: '아이템',
  RUNE: '룬',
  CHARACTER: '캐릭터',
  WEAPON: '무기',
  CLASS: '직업',
  BOSS: '보스',
  MODE: '모드',
  SYSTEM: '시스템',
  OTHER: '기타',
};

export interface ContentLink {
  href: string;
  title: string;
}

export interface ContentDetailLinks {
  /** Event a reward belongs to. */
  related: ContentLink | null;
  /** Compensation reward of a maintenance. */
  compensation: ContentLink | null;
}

const POINT_IN_TIME = new Set<ContentRecord['type']>(['PATCH', 'UPDATE', 'ANNOUNCEMENT']);

export function ContentDetail({
  record,
  family,
  generatedAt,
  adsMode,
  links,
}: {
  record: ContentRecord;
  family: ContentRouteFamily;
  generatedAt: string;
  adsMode: AdSlotMode;
  links: ContentDetailLinks;
}) {
  const game = requireGame(record.gameId);
  const view = gameView(game);
  const serverNow = Date.parse(generatedAt);
  const precision = record.timing?.precision ?? 'DATETIME';
  const d = ko.detail;
  const familyTab = FAMILY_TAB[family];
  const crumbs = [
    { name: ko.nav.home, path: '/' },
    { name: view.name, path: `/games/${view.slug}` },
    ...(familyTab.tab
      ? [{ name: familyTab.name, path: `/games/${view.slug}/${familyTab.tab}` }]
      : []),
    { name: record.title, path: contentPath(record) },
  ];
  const pointInTime = POINT_IN_TIME.has(record.type);
  const period = pointInTime
    ? record.startAt
      ? formatInstant(record.startAt, precision)
      : null
    : formatPeriod(record.startAt, record.endAt, precision);
  const countdownTarget =
    record.startAt && Date.parse(record.startAt) > serverNow
      ? record.startAt
      : (record.endAt ?? null);
  const detail = record.detail;

  return (
    <article className="space-y-6">
      <JsonLdScript data={[breadcrumbJsonLd(crumbs), contentJsonLd(record)]} />
      <Breadcrumbs items={crumbs} />

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <GameBadge name={view.name} accent={view.accent} size="md" href={`/games/${view.slug}`} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {typeLabel(record.type, record.gameId)}
          </span>
          <LiveStatusChip item={record} serverNow={serverNow} />
          {record.isSynthetic ? <StatusChip tone="sample">{ko.status.sample}</StatusChip> : null}
        </div>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-text sm:text-3xl">
          {record.title}
        </h1>
        {record.summary ? <p className="max-w-3xl text-base text-muted">{record.summary}</p> : null}
        <div className="pt-1">
          <MyGamesToggle gameId={record.gameId} source="content-detail" />
        </div>
      </header>

      {record.isSynthetic ? (
        <p className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-800 dark:text-fuchsia-200">
          {d.sampleNotice}
        </p>
      ) : null}

      <Card className="px-4 py-2">
        <dl>
          {period ? (
            <Fact label={pointInTime ? d.release : d.period}>
              <span className="font-mono tabular-nums">{period}</span>
              <span className="ml-2 text-xs text-muted">({ko.time.kst})</span>
              {precision === 'DATE' ? (
                <span className="ml-2 text-xs text-muted">· {ko.time.dateOnly}</span>
              ) : null}
            </Fact>
          ) : null}
          {record.timing && (record.timing.startAtSource || record.timing.endAtSource) ? (
            <Fact label={ko.time.sourceTime}>
              <span className="font-mono text-xs tabular-nums">
                {[record.timing.startAtSource, record.timing.endAtSource]
                  .filter(Boolean)
                  .join(' – ')}
              </span>
              {record.timing.sourceTimezone ? (
                <span className="ml-2 text-xs text-muted">
                  ({zoneLabel(record.timing.sourceTimezone)})
                </span>
              ) : null}
            </Fact>
          ) : null}
          {countdownTarget ? (
            <Fact label={d.remaining}>
              <Countdown
                target={countdownTarget}
                timeZone={VIEWER_TIMEZONE}
                precision={precision}
                className="font-bold"
              />
            </Fact>
          ) : null}
          {record.timing?.region ? (
            <Fact label={d.region}>
              {game.regions.find((r) => r.id === record.timing?.region)?.name['ko-KR'] ??
                record.timing.region}
            </Fact>
          ) : null}
          {record.sourcePublishedAt ? (
            <Fact label={d.published}>
              <span className="font-mono tabular-nums">
                {formatInstant(record.sourcePublishedAt)}
              </span>
            </Fact>
          ) : null}
          {detail.type === 'EVENT' && detail.eligibility ? (
            <Fact label={d.eligibility}>{detail.eligibility}</Fact>
          ) : null}
          {detail.type === 'REWARD' && detail.howToClaim ? (
            <Fact label={d.howToClaim}>{detail.howToClaim}</Fact>
          ) : null}
          {detail.type === 'MAINTENANCE' && detail.affectedServers.length > 0 ? (
            <Fact label={d.affectedServers}>{detail.affectedServers.join(', ')}</Fact>
          ) : null}
          {links.compensation ? (
            <Fact label={d.compensation}>
              <Link className="underline" href={links.compensation.href}>
                {links.compensation.title} →
              </Link>
            </Fact>
          ) : null}
          {links.related ? (
            <Fact label={d.relatedEvent}>
              <Link className="underline" href={links.related.href}>
                {links.related.title} →
              </Link>
            </Fact>
          ) : null}
        </dl>
      </Card>

      {detail.type === 'REDEEM_CODE' ? (
        <Card className="space-y-2 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{d.code}</p>
          <div className="flex flex-wrap items-center gap-3">
            <code
              className="rounded bg-surface-2 px-3 py-1.5 font-mono text-xl font-bold tracking-wider text-text"
              data-testid="redeem-code"
            >
              {detail.code}
            </code>
            {record.isSynthetic ? null : <CopyCodeButton code={detail.code} />}
          </div>
          {record.isSynthetic ? (
            <p
              className="text-sm font-semibold text-rose-600 dark:text-rose-400"
              data-testid="synthetic-code-warning"
            >
              {d.syntheticCode}
            </p>
          ) : null}
        </Card>
      ) : null}

      {(detail.type === 'EVENT' && detail.rewards.length > 0) ||
      ((detail.type === 'REWARD' || detail.type === 'REDEEM_CODE') && detail.items.length > 0) ? (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
            {d.rewards}
          </h2>
          <Card className="p-4">
            <RewardBadge
              max={20}
              items={
                detail.type === 'EVENT'
                  ? detail.rewards
                  : detail.type === 'REWARD' || detail.type === 'REDEEM_CODE'
                    ? detail.items
                    : []
              }
              className="text-sm"
            />
          </Card>
        </section>
      ) : null}

      {detail.type === 'BANNER' && detail.featured.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
            {d.featured}
          </h2>
          <Card as="section" className="divide-y divide-border">
            {detail.featured.map((featured) => (
              <p
                key={`${featured.name}-${featured.rarity ?? 0}`}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="font-semibold text-text">{featured.name}</span>
                {featured.rarity ? (
                  <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
                    {'★'.repeat(featured.rarity)}
                  </span>
                ) : null}
              </p>
            ))}
          </Card>
        </section>
      ) : null}

      <AdSlot placement={`${family}-detail-after-summary`} mode={adsMode} />

      {detail.type === 'PATCH' ? (
        <section aria-labelledby="patch-changes">
          <h2
            id="patch-changes"
            className="mb-2 text-sm font-bold uppercase tracking-wider text-muted"
          >
            {d.changes} <span className="tabular-nums">{detail.changes.length}</span>
          </h2>
          {detail.changes.length === 0 ? (
            <Card className="p-4 text-sm text-muted">{d.noChanges}</Card>
          ) : (
            <div className="space-y-4">
              {groupChanges(detail.changes).map(([group, changes]) => (
                <Card key={group} className="px-4">
                  <h3 className="border-b border-border py-2 text-xs font-bold uppercase tracking-wider text-muted">
                    {TARGET_GROUP_LABEL[group] ?? group} · {changes.length}
                  </h3>
                  <div className="divide-y divide-border">
                    {changes.map((change, index) => (
                      <PatchChange
                        key={`${change.targetName}-${index}`}
                        change={change}
                        typeLabels={ko.changeType}
                      />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section aria-labelledby="trust" className="rounded-lg border border-border bg-surface-2 p-4">
        <h2 id="trust" className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
          {d.trustTitle}
        </h2>
        <div className="space-y-2 text-sm">
          {/* A <dl> may only hold dt/dd groups: the facts row and the note sit between two lists. */}
          <dl>
            <div>
              <dt className="mb-1 text-xs text-muted">{d.officialSource}</dt>
              <dd>
                <SourceBadge
                  sourceName={record.source.name}
                  url={record.source.url}
                  isOfficial={record.source.isOfficial}
                  sourceTypeLabel={ko.sourceType[record.source.type]}
                  sample={record.isSynthetic}
                />
                {record.source.attribution ? (
                  <p className="mt-1 text-xs text-muted">{record.source.attribution}</p>
                ) : null}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <p>
              <span className="text-muted">{d.lastUpdated} </span>
              <time dateTime={record.updatedAt} className="font-mono tabular-nums">
                {formatInstant(record.updatedAt)}
              </time>
            </p>
            <p>
              <span className="text-muted">{d.verification} </span>
              {ko.verification[record.verification]}
            </p>
            <p>
              <span className="text-muted">{d.parser} </span>
              <span className="font-mono text-xs">
                {record.parser.id}@{record.parser.version}
              </span>
            </p>
          </div>
          <p className="text-xs text-muted">{d.structured}</p>
          {record.provenance.length > 1 ? (
            <dl>
              <div>
                <dt className="mb-1 text-xs text-muted">{d.provenance}</dt>
                <dd>
                  <ul className="space-y-0.5 text-xs">
                    {record.provenance.map((entry) => (
                      <li key={`${entry.sourceId}-${entry.firstSeenAt}`}>
                        {ko.sourceType[entry.sourceType]} · {entry.sourceName} (
                        {entry.role === 'PRIMARY' ? '주 출처' : '보조'})
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </section>
    </article>
  );
}
