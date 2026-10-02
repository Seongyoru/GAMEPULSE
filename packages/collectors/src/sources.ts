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
