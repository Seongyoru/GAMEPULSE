/**
 * The game registry. Adding a game = adding one entry here, its source adapters and fixtures.
 *
 * Feature flags are architecture hints that must be re-verified against real sources before
 * production (see docs/DATA_SOURCES.md). "limited" means partially available or unverified.
 */
import { DEFAULT_LOCALE, type Locale } from '../constants';
import type { GameConfig, GameFeature } from './types';

const ASIA_UTC8 = 'UTC+8';

const GAME_DEFINITIONS: readonly GameConfig[] = [
  {
    gameId: 'lol',
    slug: 'league-of-legends',
    name: 'League of Legends',
    localizedNames: { 'ko-KR': '리그 오브 레전드', 'en-US': 'League of Legends' },
    shortNames: { 'ko-KR': '롤', 'en-US': 'LoL' },
    publisher: 'Riot Games',
    developer: 'Riot Games',
    officialUrl: 'https://www.leagueoflegends.com/ko-kr/',
    officialHosts: ['leagueoflegends.com', 'riotgames.com'],
    status: 'ACTIVE',
    timezone: 'Asia/Seoul',
    regions: [
      {
        id: 'kr',
        name: { 'ko-KR': '한국', 'en-US': 'Korea' },
        timezone: 'Asia/Seoul',
        isDefault: true,
      },
    ],
    features: {
      patches: 'supported',
      events: 'limited',
      rewards: 'unsupported',
      resets: 'unsupported',
      maintenance: 'supported',
      banners: 'unsupported',
      redeemCodes: 'unsupported',
    },
    adapters: ['lol-fixture', 'lol-ddragon', 'lol-status'],
    accent: 'sky',
    artMotif: 'hextech',
    terminology: {},
    seoKeywords: { 'ko-KR': ['롤 패치', '롤 패치노트', '리그 오브 레전드 패치', '롤 점검'] },
    defaultForAnonymous: true,
    sortOrder: 10,
  },
  {
    gameId: 'lostark',
    slug: 'lost-ark',
    name: 'Lost Ark',
    localizedNames: { 'ko-KR': '로스트아크', 'en-US': 'Lost Ark' },
    shortNames: { 'ko-KR': '로아', 'en-US': 'Lost Ark' },
    publisher: 'Smilegate',
    developer: 'Smilegate RPG',
    officialUrl: 'https://lostark.game.onstove.com/',
    officialHosts: ['onstove.com'],
    status: 'ACTIVE',
    timezone: 'Asia/Seoul',
    regions: [
      {
        id: 'kr',
        name: { 'ko-KR': '한국', 'en-US': 'Korea' },
        timezone: 'Asia/Seoul',
        isDefault: true,
      },
    ],
    features: {
      patches: 'supported',
      events: 'supported',
      rewards: 'supported',
      resets: 'supported',
      maintenance: 'supported',
      banners: 'unsupported',
      redeemCodes: 'limited',
    },
    adapters: ['lostark-fixture', 'lostark-openapi'],
    accent: 'amber',
    artMotif: 'compass',
    terminology: {},
    seoKeywords: {
      'ko-KR': [
        '로스트아크 주간 초기화 시간',
        '로스트아크 이벤트',
        '로스트아크 업데이트',
        '로아 점검',
      ],
    },
    defaultForAnonymous: true,
    sortOrder: 20,
  },
  {
    gameId: 'maplestory',
    slug: 'maplestory',
    name: 'MapleStory',
    localizedNames: { 'ko-KR': '메이플스토리', 'en-US': 'MapleStory' },
    shortNames: { 'ko-KR': '메이플', 'en-US': 'MapleStory' },
    publisher: 'NEXON',
    developer: 'NEXON',
    officialUrl: 'https://maplestory.nexon.com/',
    officialHosts: ['nexon.com'],
    status: 'ACTIVE',
    timezone: 'Asia/Seoul',
    regions: [
      {
        id: 'kr',
        name: { 'ko-KR': '한국', 'en-US': 'Korea' },
        timezone: 'Asia/Seoul',
        isDefault: true,
      },
    ],
    features: {
      patches: 'supported',
      events: 'supported',
      rewards: 'supported',
      resets: 'supported',
      maintenance: 'supported',
      banners: 'unsupported',
      redeemCodes: 'limited',
    },
    adapters: ['maplestory-fixture', 'maplestory-openapi'],
    accent: 'orange',
    artMotif: 'maple',
    terminology: {},
    seoKeywords: {
      'ko-KR': [
        '메이플스토리 이벤트 일정',
        '메이플 주간 보스 초기화',
        '메이플스토리 업데이트',
        '메이플 점검',
      ],
    },
    defaultForAnonymous: true,
    sortOrder: 30,
  },
  {
    gameId: 'genshin',
    slug: 'genshin-impact',
    name: 'Genshin Impact',
    localizedNames: { 'ko-KR': '원신', 'en-US': 'Genshin Impact' },
    shortNames: { 'ko-KR': '원신', 'en-US': 'Genshin' },
    publisher: 'HoYoverse',
    developer: 'HoYoverse',
    officialUrl: 'https://genshin.hoyoverse.com/ko/',
    officialHosts: ['hoyoverse.com', 'hoyolab.com'],
    status: 'ACTIVE',
    timezone: ASIA_UTC8,
    regions: [
      {
        id: 'asia',
        name: { 'ko-KR': '아시아', 'en-US': 'Asia' },
        timezone: ASIA_UTC8,
        isDefault: true,
      },
      {
        id: 'america',
        name: { 'ko-KR': '미국', 'en-US': 'America' },
        timezone: 'UTC-5',
        isDefault: false,
      },
      {
        id: 'europe',
        name: { 'ko-KR': '유럽', 'en-US': 'Europe' },
        timezone: 'UTC+1',
        isDefault: false,
      },
      {
        id: 'tw-hk-mo',
        name: { 'ko-KR': 'TW/HK/MO', 'en-US': 'TW, HK, MO' },
        timezone: ASIA_UTC8,
        isDefault: false,
      },
    ],
    features: {
      patches: 'supported',
      events: 'supported',
      rewards: 'supported',
      resets: 'supported',
      maintenance: 'supported',
      banners: 'supported',
      redeemCodes: 'supported',
    },
    adapters: ['genshin-fixture'],
    accent: 'teal',
    artMotif: 'stars',
    terminology: { banner: { 'ko-KR': '기원', 'en-US': 'Wish' } },
    seoKeywords: {
      'ko-KR': ['원신 현재 이벤트', '원신 기원 일정', '원신 리딤코드', '원신 업데이트'],
    },
    defaultForAnonymous: true,
    sortOrder: 40,
  },
  {
    gameId: 'wuwa',
    slug: 'wuthering-waves',
    name: 'Wuthering Waves',
    localizedNames: { 'ko-KR': '명조: 워더링 웨이브', 'en-US': 'Wuthering Waves' },
    shortNames: { 'ko-KR': '명조', 'en-US': 'WuWa' },
    publisher: 'Kuro Games',
    developer: 'Kuro Games',
    officialUrl: 'https://wutheringwaves.kurogames.com/kr/main/news/',
    officialHosts: ['kurogames.com', 'kurogame.com'],
    status: 'ACTIVE',
    timezone: ASIA_UTC8,
    regions: [
      {
        id: 'asia',
        name: { 'ko-KR': '아시아', 'en-US': 'Asia' },
        timezone: ASIA_UTC8,
        isDefault: true,
      },
      {
        id: 'america',
        name: { 'ko-KR': '미국', 'en-US': 'America' },
        timezone: 'UTC-5',
        isDefault: false,
      },
      {
        id: 'europe',
        name: { 'ko-KR': '유럽', 'en-US': 'Europe' },
        timezone: 'UTC+1',
        isDefault: false,
      },
      {
        id: 'sea',
        name: { 'ko-KR': '동남아', 'en-US': 'SEA' },
        timezone: ASIA_UTC8,
        isDefault: false,
      },
      {
        id: 'hmt',
        name: { 'ko-KR': 'HMT', 'en-US': 'HMT' },
        timezone: ASIA_UTC8,
        isDefault: false,
      },
    ],
    features: {
      patches: 'supported',
      events: 'supported',
      rewards: 'supported',
      resets: 'supported',
      maintenance: 'supported',
      banners: 'supported',
      redeemCodes: 'limited',
    },
    adapters: ['wuwa-fixture'],
    accent: 'violet',
    artMotif: 'waves',
    terminology: { banner: { 'ko-KR': '픽업', 'en-US': 'Convene' } },
    seoKeywords: {
      'ko-KR': ['명조 이벤트 일정', '명조 픽업 일정', '명조 업데이트', '명조 리딤코드'],
    },
    defaultForAnonymous: true,
    sortOrder: 50,
  },
  {
    // Prepared ahead of launch and hidden until its content is loaded and its reset rules are
    // checked (docs/research/2026-10-02-zzz-nte.md, ROADMAP › Game backlog).
    gameId: 'zzz',
    slug: 'zenless-zone-zero',
    name: 'Zenless Zone Zero',
    localizedNames: { 'ko-KR': '젠레스 존 제로', 'en-US': 'Zenless Zone Zero' },
    shortNames: { 'ko-KR': '젠존제', 'en-US': 'ZZZ' },
    publisher: 'HoYoverse',
    developer: 'HoYoverse',
    officialUrl: 'https://zenless.hoyoverse.com/ko-kr/',
    officialHosts: ['hoyoverse.com', 'hoyolab.com'],
    status: 'INACTIVE',
    timezone: ASIA_UTC8,
    regions: [
      {
        id: 'asia',
        name: { 'ko-KR': '아시아', 'en-US': 'Asia' },
        timezone: ASIA_UTC8,
        isDefault: true,
      },
      {
        id: 'america',
        name: { 'ko-KR': '아메리카', 'en-US': 'America' },
        timezone: 'UTC-5',
        isDefault: false,
      },
      {
        id: 'europe',
        name: { 'ko-KR': '유럽', 'en-US': 'Europe' },
        timezone: 'UTC+1',
        isDefault: false,
      },
      {
        id: 'tw-hk-mo',
        name: { 'ko-KR': 'TW/HK/MO', 'en-US': 'TW, HK, MO' },
        timezone: ASIA_UTC8,
        isDefault: false,
      },
    ],
    features: {
      patches: 'supported',
      events: 'supported',
      rewards: 'supported',
      resets: 'supported',
      maintenance: 'supported',
      banners: 'supported',
      redeemCodes: 'supported',
    },
    adapters: ['zzz-fixture'],
    accent: 'lime',
    artMotif: 'hazard',
    terminology: { banner: { 'ko-KR': '채널', 'en-US': 'Channel' } },
    seoKeywords: {
      'ko-KR': [
        '젠레스 존 제로 이벤트',
        '젠레스 존 제로 채널 일정',
        '젠레스 존 제로 리딤코드',
        '젠레스 존 제로 업데이트',
      ],
    },
    defaultForAnonymous: true,
    sortOrder: 60,
  },
];

export const GAMES: readonly GameConfig[] = [...GAME_DEFINITIONS].sort(
  (a, b) => a.sortOrder - b.sortOrder,
);

const BY_ID = new Map(GAMES.map((game) => [game.gameId, game]));
const BY_SLUG = new Map(GAMES.map((game) => [game.slug, game]));

/**
 * Whether a game is shown on the site. INACTIVE games are registered but hidden everywhere
 * (listings, MY GAMES, content, sitemap) and not collected on a schedule — for games prepared
 * ahead of launch, paused, or taken down at a publisher's request.
 */
export function isPublicGame(game: GameConfig): boolean {
  return game.status !== 'INACTIVE';
}

const PUBLIC_GAMES: readonly GameConfig[] = GAMES.filter(isPublicGame);

/** Every registered game, hidden ones included (pipeline, seed, operator tools). */
export function listGames(): readonly GameConfig[] {
  return GAMES;
}

/** Games shown on the site. Everything user-facing lists games through this. */
export function listPublicGames(): readonly GameConfig[] {
  return PUBLIC_GAMES;
}

export function isPublicGameId(gameId: string): boolean {
  const game = BY_ID.get(gameId);
  return game !== undefined && isPublicGame(game);
}

/** Keeps entries (content, slugs, reset rules, selections) that belong to public games. */
export function onlyPublicGames<T extends { readonly gameId: string }>(entries: readonly T[]): T[] {
  return entries.filter((entry) => isPublicGameId(entry.gameId));
}

export function listGameIds(): string[] {
  return GAMES.map((game) => game.gameId);
}

export function getGame(gameId: string): GameConfig | undefined {
  return BY_ID.get(gameId);
}

export function requireGame(gameId: string): GameConfig {
  const game = BY_ID.get(gameId);
  if (!game) throw new Error(`Unknown game id: "${gameId}"`);
  return game;
}

export function getGameBySlug(slug: string): GameConfig | undefined {
  return BY_SLUG.get(slug);
}

export function isGameId(value: string): boolean {
  return BY_ID.has(value);
}

/** Games shown to anonymous users before MY GAMES is configured. */
export function defaultGameIds(): string[] {
  return PUBLIC_GAMES.filter((game) => game.defaultForAnonymous).map((game) => game.gameId);
}

export function localizedText(
  text: Readonly<Partial<Record<Locale, string>>> & { readonly 'en-US': string },
  locale: Locale = DEFAULT_LOCALE,
): string {
  return text[locale] ?? text['en-US'];
}

export function gameDisplayName(game: GameConfig, locale: Locale = DEFAULT_LOCALE): string {
  return localizedText(game.localizedNames, locale);
}

export function gameShortName(game: GameConfig, locale: Locale = DEFAULT_LOCALE): string {
  return localizedText(game.shortNames, locale);
}

export function isFeatureAvailable(game: GameConfig, feature: GameFeature): boolean {
  return game.features[feature] !== 'unsupported';
}

export function defaultRegion(game: GameConfig) {
  return game.regions.find((region) => region.isDefault) ?? game.regions[0];
}
