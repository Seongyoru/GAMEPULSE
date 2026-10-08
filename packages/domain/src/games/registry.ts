/**
 * The game registry. Adding a game = adding one entry here, its source adapters and fixtures.
 *
 * Feature flags are architecture hints that must be re-verified against real sources before
 * production (see docs/DATA_SOURCES.md). "limited" means partially available or unverified.
 */
import { DEFAULT_LOCALE, type Locale } from '../constants';
import type { GameConfig, GameFeature } from './types';

const ASIA_UTC8 = 'UTC+8';

const ALL_FEATURES: GameConfig['features'] = {
  patches: 'supported',
  events: 'supported',
  rewards: 'supported',
  resets: 'supported',
  maintenance: 'supported',
  banners: 'supported',
  redeemCodes: 'supported',
};

interface SubcultureGameSpec {
  gameId: string;
  slug: string;
  name: string;
  ko: string;
  shortKo: string;
  shortEn: string;
  publisher: string;
  developer: string;
  officialUrl: string;
  officialHosts: readonly string[];
  /** Zone of the server Korean players use. */
  timezone: string;
  /** Name of that server; Korean-only services use "한국". */
  server?: { id: string; ko: string; en: string };
  /** The game's word for gacha banners, e.g. 모집, 워프. */
  bannerTerm: { ko: string; en: string };
  features?: Partial<GameConfig['features']>;
  accent: GameConfig['accent'];
  /** Placeholder art (D-037): existing motifs are reused until licensed artwork replaces them. */
  artMotif: GameConfig['artMotif'];
  defaultForAnonymous?: boolean;
  sortOrder: number;
}

/**
 * A subculture game with one Korean-facing server and a synthetic fixture feed. Facts are
 * researched per game (docs/research/2026-10-08-subculture-games.md) and stay unverified until a
 * person checks them in game.
 */
function subcultureGame(spec: SubcultureGameSpec): GameConfig {
  const server = spec.server ?? { id: 'kr', ko: '한국', en: 'Korea' };
  return {
    gameId: spec.gameId,
    slug: spec.slug,
    name: spec.name,
    localizedNames: { 'ko-KR': spec.ko, 'en-US': spec.name },
    shortNames: { 'ko-KR': spec.shortKo, 'en-US': spec.shortEn },
    publisher: spec.publisher,
    developer: spec.developer,
    officialUrl: spec.officialUrl,
    officialHosts: spec.officialHosts,
    status: 'ACTIVE',
    timezone: spec.timezone,
    regions: [
      {
        id: server.id,
        name: { 'ko-KR': server.ko, 'en-US': server.en },
        timezone: spec.timezone,
        isDefault: true,
      },
    ],
    features: { ...ALL_FEATURES, ...spec.features },
    adapters: [`${spec.gameId}-fixture`],
    accent: spec.accent,
    artMotif: spec.artMotif,
    terminology: { banner: { 'ko-KR': spec.bannerTerm.ko, 'en-US': spec.bannerTerm.en } },
    seoKeywords: {
      'ko-KR': [
        `${spec.ko} 이벤트`,
        `${spec.ko} ${spec.bannerTerm.ko} 일정`,
        `${spec.ko} 쿠폰`,
        `${spec.ko} 업데이트`,
        `${spec.shortKo} 초기화 시간`,
      ],
    },
    defaultForAnonymous: spec.defaultForAnonymous ?? false,
    sortOrder: spec.sortOrder,
  };
}

const GAME_DEFINITIONS: readonly GameConfig[] = [
  // PC online games, hidden since GAMEPULSE focuses on subculture games (D-037). Kept as
  // configuration so they can return without new code.
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
    status: 'INACTIVE',
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
    status: 'INACTIVE',
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
    status: 'INACTIVE',
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
    // Research: docs/research/2026-10-02-zzz-nte.md. Reset rules remain UNVERIFIED in game.
    gameId: 'zzz',
    slug: 'zenless-zone-zero',
    name: 'Zenless Zone Zero',
    localizedNames: { 'ko-KR': '젠레스 존 제로', 'en-US': 'Zenless Zone Zero' },
    shortNames: { 'ko-KR': '젠존제', 'en-US': 'ZZZ' },
    publisher: 'HoYoverse',
    developer: 'HoYoverse',
    officialUrl: 'https://zenless.hoyoverse.com/ko-kr/',
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
  // Subculture games (D-037), researched 2026-10-08.
  subcultureGame({
    gameId: 'hsr',
    slug: 'honkai-star-rail',
    name: 'Honkai: Star Rail',
    ko: '붕괴: 스타레일',
    shortKo: '스타레일',
    shortEn: 'HSR',
    publisher: 'HoYoverse',
    developer: 'HoYoverse',
    officialUrl: 'https://hsr.hoyoverse.com/ko-kr/home',
    officialHosts: ['hoyoverse.com', 'hoyolab.com'],
    timezone: 'UTC+8',
    server: { id: 'asia', ko: '아시아', en: 'Asia' },
    bannerTerm: { ko: '워프', en: 'Warp' },
    accent: 'indigo',
    artMotif: 'stars',
    defaultForAnonymous: true,
    sortOrder: 42,
  }),
  subcultureGame({
    gameId: 'bluearchive',
    slug: 'blue-archive',
    name: 'Blue Archive',
    ko: '블루 아카이브',
    shortKo: '블아',
    shortEn: 'BA',
    publisher: 'NEXON',
    developer: 'NEXON Games',
    officialUrl: 'https://bluearchive.nexon.com/',
    officialHosts: ['nexon.com'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '모집', en: 'Recruitment' },
    accent: 'sky',
    artMotif: 'waves',
    defaultForAnonymous: true,
    sortOrder: 70,
  }),
  subcultureGame({
    gameId: 'nikke',
    slug: 'goddess-of-victory-nikke',
    name: 'GODDESS OF VICTORY: NIKKE',
    ko: '승리의 여신: 니케',
    shortKo: '니케',
    shortEn: 'NIKKE',
    publisher: 'Level Infinite',
    developer: 'SHIFT UP',
    officialUrl: 'https://nikke-kr.com/',
    officialHosts: ['nikke-kr.com', 'blablalink.com'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '모집', en: 'Recruit' },
    accent: 'rose',
    artMotif: 'hazard',
    defaultForAnonymous: true,
    sortOrder: 80,
  }),
  subcultureGame({
    gameId: 'umamusume',
    slug: 'umamusume-pretty-derby',
    name: 'Umamusume: Pretty Derby',
    ko: '우마무스메 프리티 더비',
    shortKo: '우마무스메',
    shortEn: 'Umamusume',
    publisher: 'Kakao Games',
    developer: 'Cygames',
    officialUrl: 'https://umamusume.kakaogames.com/',
    officialHosts: ['kakaogames.com'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '가챠', en: 'Gacha' },
    accent: 'orange',
    artMotif: 'maple',
    defaultForAnonymous: true,
    sortOrder: 90,
  }),
  subcultureGame({
    gameId: 'trickcal',
    slug: 'trickcal-revive',
    name: 'Trickcal Re:VIVE',
    ko: '트릭컬 리바이브',
    shortKo: '트릭컬',
    shortEn: 'Trickcal',
    publisher: 'EPIDGames',
    developer: 'EPIDGames',
    officialUrl: 'https://trickcal.com/',
    officialHosts: ['trickcal.com'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '모집', en: 'Recruitment' },
    accent: 'lime',
    artMotif: 'maple',
    defaultForAnonymous: true,
    sortOrder: 100,
  }),
  subcultureGame({
    gameId: 'arknights',
    slug: 'arknights',
    name: 'Arknights',
    ko: '명일방주',
    shortKo: '명방',
    shortEn: 'AK',
    publisher: 'Yostar',
    developer: 'Hypergryph',
    officialUrl: 'https://www.arknights.kr/',
    officialHosts: ['arknights.kr'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '헤드헌팅', en: 'Headhunting' },
    features: { redeemCodes: 'limited' },
    accent: 'teal',
    artMotif: 'compass',
    sortOrder: 110,
  }),
  subcultureGame({
    gameId: 'limbus',
    slug: 'limbus-company',
    name: 'Limbus Company',
    ko: '림버스 컴퍼니',
    shortKo: '림버스',
    shortEn: 'Limbus',
    publisher: 'Project Moon',
    developer: 'Project Moon',
    officialUrl: 'https://limbuscompany.kr/',
    officialHosts: ['limbuscompany.kr', 'limbuscompany.com', 'projectmoon.studio'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '추출', en: 'Extraction' },
    features: { redeemCodes: 'unsupported' },
    accent: 'amber',
    artMotif: 'hextech',
    sortOrder: 120,
  }),
  subcultureGame({
    gameId: 'epic7',
    slug: 'epic-seven',
    name: 'Epic Seven',
    ko: '에픽세븐',
    shortKo: '에픽세븐',
    shortEn: 'E7',
    publisher: 'Smilegate',
    developer: 'Super Creative',
    officialUrl: 'https://epic7.onstove.com/ko',
    officialHosts: ['onstove.com'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '소환', en: 'Summon' },
    accent: 'rose',
    artMotif: 'stars',
    sortOrder: 130,
  }),
  subcultureGame({
    gameId: 'fgo',
    slug: 'fate-grand-order',
    name: 'Fate/Grand Order',
    ko: '페이트/그랜드 오더',
    shortKo: '페그오',
    shortEn: 'FGO',
    publisher: 'Netmarble',
    developer: 'Lasengle',
    officialUrl: 'https://fgo.netmarble.com',
    officialHosts: ['netmarble.com'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '소환', en: 'Summon' },
    features: { redeemCodes: 'limited' },
    accent: 'indigo',
    artMotif: 'compass',
    sortOrder: 140,
  }),
  subcultureGame({
    gameId: 'gf2',
    slug: 'girls-frontline-2-exilium',
    name: "Girls' Frontline 2: Exilium",
    ko: '소녀전선2: 망명',
    shortKo: '소전2',
    shortEn: 'GF2',
    publisher: 'HaoPlay',
    developer: 'Sunborn',
    officialUrl: 'https://gf2.haoplay.com/kr/',
    officialHosts: ['haoplay.com'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '발주', en: 'Procurement' },
    accent: 'violet',
    artMotif: 'hazard',
    sortOrder: 150,
  }),
  subcultureGame({
    gameId: 'hi3',
    slug: 'honkai-impact-3rd',
    name: 'Honkai Impact 3rd',
    ko: '붕괴3rd',
    shortKo: '붕3',
    shortEn: 'HI3',
    publisher: 'HoYoverse',
    developer: 'HoYoverse',
    officialUrl: 'https://honkaiimpact3.hoyoverse.com/kr/ko-kr/',
    officialHosts: ['hoyoverse.com', 'hoyolab.com'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '보급', en: 'Supply' },
    accent: 'sky',
    artMotif: 'hextech',
    sortOrder: 160,
  }),
  subcultureGame({
    gameId: 'gfl',
    slug: 'girls-frontline',
    name: "Girls' Frontline",
    ko: '소녀전선',
    shortKo: '소전',
    shortEn: 'GFL',
    publisher: 'X.D. Global',
    developer: 'Sunborn',
    officialUrl: 'http://www.girlsfrontline.co.kr/',
    officialHosts: ['girlsfrontline.co.kr'],
    timezone: 'Asia/Seoul',
    bannerTerm: { ko: '제조', en: 'Production' },
    features: { redeemCodes: 'limited' },
    accent: 'amber',
    artMotif: 'compass',
    sortOrder: 170,
  }),
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
