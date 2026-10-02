/**
 * Presentation helpers shared by server and client components (pure).
 */
import {
  computeMaintenanceState,
  computeStatusForType,
  DEFAULT_TIMEZONE,
  describeTimeZone,
  formatCompactDate,
  formatCompactDateTime,
  getGame,
  toCalendarDate,
  weekdayLabel,
  isClaimable,
  localizedText,
  NEW_CONTENT_WINDOW_MS,
  requireGame,
  toEpochMs,
  type ContentType,
  type GameAccent,
  type GameConfig,
} from '@gamepulse/domain';
import type { Tone } from '@gamepulse/ui';
import { ko } from './i18n';

/** All times are shown in Korean time for the initial market. */
export const VIEWER_TIMEZONE = DEFAULT_TIMEZONE;
export const VIEWER_LOCALE = 'ko-KR';

export interface GameView {
  gameId: string;
  slug: string;
  name: string;
  shortName: string;
  /** Canonical English name, shown under the Korean title on title cards. */
  englishName: string;
  publisher: string;
  accent: GameAccent;
}

export function gameView(game: GameConfig): GameView {
  return {
    gameId: game.gameId,
    slug: game.slug,
    name: localizedText(game.localizedNames, 'ko-KR'),
    shortName: localizedText(game.shortNames, 'ko-KR'),
    englishName: game.name,
    publisher: game.publisher,
    accent: game.accent,
  };
}

export function gameViewById(gameId: string): GameView {
  return gameView(requireGame(gameId));
}

/** Content type label, using game terminology where it exists (e.g. Genshin "기원"). */
export function typeLabel(type: ContentType, gameId?: string): string {
  if (type === 'BANNER' && gameId) {
    const banner = getGame(gameId)?.terminology.banner;
    if (banner) return localizedText(banner, 'ko-KR');
  }
  return ko.contentType[type];
}

export interface StatusPresentation {
  tone: Tone;
  label: string;
}

interface TimedItem {
  type: ContentType;
  startAt: string | null;
  endAt: string | null;
  sourcePublishedAt?: string | null;
  publishedAt?: string;
}

export function statusPresentation(item: TimedItem, nowMs: number): StatusPresentation | null {
  const s = ko.status;
  switch (item.type) {
    case 'MAINTENANCE': {
      const state = computeMaintenanceState(item, nowMs);
      if (state === 'IN_PROGRESS') return { tone: 'urgent', label: s.maintenanceLive };
      if (state === 'SCHEDULED') return { tone: 'upcoming', label: s.maintenanceScheduled };
      if (state === 'COMPLETED') return { tone: 'ended', label: s.maintenanceDone };
      return { tone: 'neutral', label: s.unknown };
    }
    case 'REWARD':
    case 'REDEEM_CODE': {
      const status = computeStatusForType(item.type, item, nowMs);
      if (status === 'UPCOMING') return { tone: 'upcoming', label: s.upcoming };
      if (status === 'ENDED') return { tone: 'ended', label: s.expired };
      if (status === 'ENDING_SOON') return { tone: 'soon', label: s.claimSoon };
      return isClaimable(item, nowMs)
        ? { tone: 'live', label: s.available }
        : { tone: 'neutral', label: s.unknown };
    }
    case 'PATCH':
    case 'UPDATE': {
      const release = toEpochMs(item.startAt) ?? toEpochMs(item.sourcePublishedAt ?? null);
      if (release === null) return null;
      if (release > nowMs) return { tone: 'upcoming', label: s.releasing };
      if (nowMs - release <= NEW_CONTENT_WINDOW_MS) return { tone: 'info', label: s.isNew };
      return { tone: 'neutral', label: s.released };
    }
    case 'EVENT':
    case 'BANNER': {
      const status = computeStatusForType(item.type, item, nowMs);
      if (status === 'UPCOMING') return { tone: 'upcoming', label: s.upcoming };
      if (status === 'ENDED') return { tone: 'ended', label: s.ended };
      if (status === 'ENDING_SOON') return { tone: 'soon', label: s.endingSoon };
      if (status === 'LIVE') return { tone: 'live', label: s.live };
      return null;
    }
    case 'ANNOUNCEMENT':
      return null;
  }
}

/** "10.01 (목) 10:00 – 10.21 (수) 03:59" in the viewer zone (date only for DATE precision). */
export function formatPeriod(
  startAt: string | null,
  endAt: string | null,
  precision: 'DATETIME' | 'DATE' = 'DATETIME',
): string | null {
  const fmt = (value: string) => {
    const text = formatCompactDateTime(value, VIEWER_TIMEZONE, VIEWER_LOCALE);
    return precision === 'DATE' ? text.slice(0, -6) : text;
  };
  if (startAt && endAt) return `${fmt(startAt)} – ${fmt(endAt)}`;
  if (startAt) return `${fmt(startAt)} ~`;
  if (endAt) return `~ ${fmt(endAt)}`;
  return null;
}

export function formatInstant(value: string, precision: 'DATETIME' | 'DATE' = 'DATETIME'): string {
  const text = formatCompactDateTime(value, VIEWER_TIMEZONE, VIEWER_LOCALE, { year: true });
  return precision === 'DATE' ? text.slice(0, -6) : text;
}

/** "2026.10.02 (금)" in the viewer zone. */
export function formatCompactDateHeading(now: Date): string {
  return `${formatCompactDate(now, VIEWER_TIMEZONE)} (${weekdayLabel(toCalendarDate(now, VIEWER_TIMEZONE), VIEWER_LOCALE)})`;
}

export function zoneLabel(timeZone: string): string {
  if (timeZone === 'Asia/Seoul') return '한국 시간';
  return describeTimeZone(timeZone);
}
