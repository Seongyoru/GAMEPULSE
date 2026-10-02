/**
 * Source definitions that exist for every game: the synthetic fixture feed and manual
 * administrator input. Live source definitions live next to their adapters (./sources/*).
 */
import { CONTENT_TYPES, type GameConfig, type SourceDefinition } from '@gamepulse/domain';

export function fixtureSourceFor(game: GameConfig): SourceDefinition {
  return {
    id: `${game.gameId}-fixture`,
    gameId: game.gameId,
    name: 'GAMEPULSE 샘플 데이터',
    type: 'FIXTURE',
    isOfficial: false,
    homepageUrl: game.officialUrl,
    allowedHosts: [...game.officialHosts],
    authentication: 'NOT_APPLICABLE',
    rateLimit: null,
    contentTypes: [...CONTENT_TYPES],
    collectorStatus: 'FIXTURE_ONLY',
    termsUrl: null,
    termsReviewedAt: null,
    robotsPolicy: null,
    attribution: null,
    dataRetentionDays: null,
    notes:
      'Clearly synthetic development data. Links point to the publisher news page, not to real articles.',
  };
}

export function manualSourceFor(game: GameConfig): SourceDefinition {
  return {
    id: `${game.gameId}-manual`,
    gameId: game.gameId,
    name: 'GAMEPULSE 운영팀 확인',
    type: 'MANUAL',
    isOfficial: false,
    homepageUrl: game.officialUrl,
    allowedHosts: [...game.officialHosts],
    authentication: 'NOT_APPLICABLE',
    rateLimit: null,
    contentTypes: [...CONTENT_TYPES],
    collectorStatus: 'MANUAL_ONLY',
    termsUrl: null,
    termsReviewedAt: null,
    robotsPolicy: null,
    attribution: null,
    dataRetentionDays: null,
    notes: 'Administrator-entered structured facts; every item must cite an official source URL.',
  };
}

/**
 * Mock-mode twin of a live source. Mock mode replays development responses, so its records
 * are synthetic fixture data under their own source id: they can never be confused with,
 * or supersede, records collected from the real official source.
 */
export function mockSourceFor(source: SourceDefinition): SourceDefinition {
  return {
    ...source,
    id: `${source.id}-mock`,
    name: `${source.name} (모의 응답)`,
    type: 'FIXTURE',
    isOfficial: false,
    authentication: 'NOT_APPLICABLE',
    collectorStatus: 'FIXTURE_ONLY',
    notes: `Mock-mode responses for ${source.id} (fixtures/http). Synthetic development data.`,
  };
}

/**
 * Official sources reviewed and deliberately not collected automatically (terms or robots).
 * Listed so the sources table records the decision; their facts arrive via manual ingestion.
 */
export const REFERENCE_SOURCES: readonly SourceDefinition[] = [
  {
    id: 'lol-patch-notes-web',
    gameId: 'lol',
    name: '리그 오브 레전드 패치 노트 (웹)',
    type: 'OFFICIAL_WEB',
    isOfficial: true,
    homepageUrl: 'https://www.leagueoflegends.com/ko-kr/news/tags/patch-notes/',
    allowedHosts: ['leagueoflegends.com', 'riotgames.com'],
    authentication: 'NONE',
    rateLimit: null,
    contentTypes: ['PATCH'],
    collectorStatus: 'MANUAL_ONLY',
    termsUrl: 'https://www.riotgames.com/en/terms-of-service',
    termsReviewedAt: '2026-10-02',
    robotsPolicy:
      'robots.txt allows all, but the Riot ToS forbids bots and scraping of Riot Services.',
    attribution: null,
    dataRetentionDays: null,
    notes: 'Patch notes enter through manual ingestion with the official article URL.',
  },
  {
    id: 'genshin-official-web',
    gameId: 'genshin',
    name: '원신 공식 홈페이지 소식',
    type: 'OFFICIAL_WEB',
    isOfficial: true,
    homepageUrl: 'https://genshin.hoyoverse.com/ko/news',
    allowedHosts: ['hoyoverse.com', 'hoyolab.com'],
    authentication: 'NONE',
    rateLimit: null,
    contentTypes: ['PATCH', 'EVENT', 'BANNER', 'MAINTENANCE', 'REDEEM_CODE', 'ANNOUNCEMENT'],
    collectorStatus: 'DISABLED',
    termsUrl: 'https://genshin.hoyoverse.com/ko/company/terms',
    termsReviewedAt: '2026-10-02',
    robotsPolicy:
      'No documented API or feed; the terms prohibit scraping/copying without written permission.',
    attribution: null,
    dataRetentionDays: null,
    notes: 'Disabled until HoYoverse grants written permission; manual ingestion meanwhile.',
  },
  {
    id: 'wuwa-official-web',
    gameId: 'wuwa',
    name: '명조: 워더링 웨이브 공식 홈페이지 소식',
    type: 'OFFICIAL_WEB',
    isOfficial: true,
    homepageUrl: 'https://wutheringwaves.kurogames.com/kr/main/news/',
    allowedHosts: ['kurogames.com', 'kurogame.com'],
    authentication: 'NONE',
    rateLimit: null,
    contentTypes: ['PATCH', 'EVENT', 'BANNER', 'MAINTENANCE', 'REDEEM_CODE', 'ANNOUNCEMENT'],
    collectorStatus: 'DISABLED',
    termsUrl: null,
    termsReviewedAt: '2026-10-02',
    robotsPolicy:
      'robots.txt has no rules, but no documented API/feed exists and the terms forbid copying.',
    attribution: null,
    dataRetentionDays: null,
    notes:
      'Terms of Use (2025-09-29) §2(4) forbid downloading/copying content without prior written consent. Disabled until Kuro Games grants permission; manual ingestion meanwhile.',
  },
  {
    id: 'zzz-official-web',
    gameId: 'zzz',
    name: '젠레스 존 제로 공식 홈페이지 소식',
    type: 'OFFICIAL_WEB',
    isOfficial: true,
    homepageUrl: 'https://zenless.hoyoverse.com/ko-kr/news',
    allowedHosts: ['hoyoverse.com', 'hoyolab.com'],
    authentication: 'NONE',
    rateLimit: null,
    contentTypes: ['UPDATE', 'EVENT', 'BANNER', 'MAINTENANCE', 'REDEEM_CODE', 'ANNOUNCEMENT'],
    collectorStatus: 'DISABLED',
    termsUrl: 'https://zenless.hoyoverse.com/ko-kr/company/terms',
    termsReviewedAt: '2026-10-02',
    robotsPolicy:
      'robots.txt is absent (404), but no documented API or feed exists and the terms prohibit scraping without written permission.',
    attribution: null,
    dataRetentionDays: null,
    notes:
      'Same terms as Genshin Impact (ToS §7(c), 이용약관 제8조 8)). Disabled until HoYoverse grants written permission; manual ingestion meanwhile.',
  },
];
