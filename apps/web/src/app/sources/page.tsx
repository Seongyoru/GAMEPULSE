import { listSourceDefinitions } from '@gamepulse/collectors';
import {
  type CollectorStatus,
  isPublicGameId,
  listPublicGames,
  SOURCE_TYPES,
  type SourceDefinition,
} from '@gamepulse/domain';
import { PolicyPage } from '@/components/content/policy-page';
import { ko } from '@/lib/i18n';
import { gameView } from '@/lib/present';
import { pageMetadata } from '@/server/seo';

export const metadata = pageMetadata({
  title: '데이터 출처',
  description:
    'GAMEPULSE가 사용하는 게임별 공식 출처와 수집 방식, 약관 검토 현황, 출처 표기를 공개합니다.',
  path: '/sources',
});

const STATUS_LABEL: Readonly<Record<CollectorStatus, string>> = {
  ENABLED: '공식 API 자동 수집',
  PENDING_REVIEW: '약관 확인 중 (수집 안 함)',
  DISABLED: '자동 수집 안 함 (약관)',
  MANUAL_ONLY: '운영팀 직접 입력',
  FIXTURE_ONLY: '개발용 샘플',
};

function SourceRow({ source }: { source: SourceDefinition }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a
          href={source.homepageUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-source-link
          className="font-semibold text-text hover:underline"
        >
          {source.name} ↗
        </a>
        <span className="text-xs font-semibold text-muted">
          {STATUS_LABEL[source.collectorStatus]}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {ko.sourceType[source.type]}
        {source.termsReviewedAt ? ` · 약관 검토 ${source.termsReviewedAt}` : ''}
        {source.dataRetentionDays ? ` · 보관 기간 ${source.dataRetentionDays}일` : ''}
      </p>
      {source.attribution ? (
        <p className="mt-1 text-xs font-semibold text-text">{source.attribution}</p>
      ) : null}
    </li>
  );
}

export default function SourcesPage() {
  // Most authoritative first: official API → feed → website → operator input.
  const sources = listSourceDefinitions()
    .filter((source) => source.type !== 'FIXTURE' && isPublicGameId(source.gameId))
    .sort((a, b) => SOURCE_TYPES.indexOf(a.type) - SOURCE_TYPES.indexOf(b.type));
  return (
    <PolicyPage
      title="데이터 출처"
      path="/sources"
      updatedAt="2026-10-02"
      intro={
        <p>
          GAMEPULSE는 공식 API → 공식 피드 → 공식 홈페이지 → 운영팀 확인 순으로 출처를 신뢰하며,
          약관과 robots.txt가 허용하는 경우에만 자동으로 수집합니다. 자동 수집이 허용되지 않는
          게임은 운영팀이 공식 공지를 확인해 직접 입력합니다.
        </p>
      }
      sections={listPublicGames().map((game) => ({
        title: gameView(game).name,
        body: (
          <ul className="space-y-2">
            {sources
              .filter((source) => source.gameId === game.gameId)
              .map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
          </ul>
        ),
      }))}
    />
  );
}
