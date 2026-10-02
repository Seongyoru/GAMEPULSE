import type { SourceDefinition } from '@gamepulse/domain';

/**
 * Lost Ark KR Open API (Smilegate). Research: docs/research/2026-10-02-riot-lostark.md.
 * Held at PENDING_REVIEW: the terms forbid "storing any Content" while the usage guide
 * recommends caching; collection stays off until Smilegate clarifies in writing.
 */
export const LOSTARK_OPENAPI_SOURCE: SourceDefinition = {
  id: 'lostark-openapi',
  gameId: 'lostark',
  name: '로스트아크 공식 Open API',
  type: 'OFFICIAL_API',
  isOfficial: true,
  homepageUrl: 'https://developer-lostark.game.onstove.com/',
  allowedHosts: ['lostark.game.onstove.com'],
  authentication: 'API_KEY',
  rateLimit: '100 requests/minute per client (X-RateLimit-* headers); HTTP 503 during maintenance',
  contentTypes: ['EVENT', 'REWARD', 'MAINTENANCE', 'ANNOUNCEMENT'],
  collectorStatus: 'PENDING_REVIEW',
  termsUrl: 'https://developer-lostark.game.onstove.com/agreement',
  termsReviewedAt: '2026-10-02',
  robotsPolicy:
    'API host publishes no robots.txt (official API, authenticated). lostark.game.onstove.com is not crawled.',
  attribution: null,
  dataRetentionDays: null,
  notes:
    'Terms §storage conflict with the usage guide caching advice; written clarification requested (developer-lostark@smilegate.com). Offset-less API times are KR service times (Asia/Seoul).',
};
