import 'server-only';
import {
  getGameBySlug,
  isFeatureAvailable,
  isPublicGame,
  listPublicGames,
  type GameConfig,
} from '@gamepulse/domain';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ko } from '@/lib/i18n';
import { gameView } from '@/lib/present';
import { pageMetadata } from './seo';

export const GAME_TABS = [
  'overview',
  'patches',
  'events',
  'rewards',
  'resets',
  'calendar',
] as const;
export type GameTab = (typeof GAME_TABS)[number];

/** Resolves a /games/[game] slug or renders the 404 page. */
export function gameFromParam(slug: string): GameConfig {
  const game = getGameBySlug(slug);
  if (!game || !isPublicGame(game)) notFound();
  return game;
}

export function gameStaticParams(): Array<{ game: string }> {
  return listPublicGames().map((game) => ({ game: game.slug }));
}

/** Whether a tab has anything to show for this game (driven by GameConfig.features). */
export function isTabAvailable(game: GameConfig, tab: GameTab): boolean {
  switch (tab) {
    case 'overview':
    case 'calendar':
      return true;
    case 'patches':
      return isFeatureAvailable(game, 'patches');
    case 'events':
      return isFeatureAvailable(game, 'events') || isFeatureAvailable(game, 'banners');
    case 'rewards':
      return isFeatureAvailable(game, 'rewards') || isFeatureAvailable(game, 'redeemCodes');
    case 'resets':
      return isFeatureAvailable(game, 'resets');
  }
}

export function gameTabPath(game: GameConfig, tab: GameTab): string {
  return tab === 'overview' ? `/games/${game.slug}` : `/games/${game.slug}/${tab}`;
}

export function gameTabs(game: GameConfig): Array<{ tab: GameTab; label: string; href: string }> {
  return GAME_TABS.filter((tab) => isTabAvailable(game, tab)).map((tab) => ({
    tab,
    label: ko.game.tabs[tab],
    href: gameTabPath(game, tab),
  }));
}

export type GameParams = Promise<{ game: string }>;

export async function gameTabMetadata(params: GameParams, tab: GameTab): Promise<Metadata> {
  const { game: slug } = await params;
  const game = gameFromParam(slug);
  const name = gameView(game).name;
  return pageMetadata({
    title: ko.game.pageTitle[tab](name),
    description: ko.game.pageDescription[tab](name),
    path: gameTabPath(game, tab),
    noIndex: !isTabAvailable(game, tab),
  });
}
