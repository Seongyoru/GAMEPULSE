/**
 * Original key art for every game (no publisher artwork or logos, D-036). Each game's art is
 * drawn once into an SVG sprite (game-art-sprite.tsx) from its motif and accent palette; covers,
 * title cards and marks reference it with <use>, so a page full of cards carries the drawing once. Shapes come
 * from a PRNG seeded by the game id: the same game always gets the same picture on the server
 * and in the browser.
 */
import type { GameAccent, GameArtMotif } from '@gamepulse/domain';
import type { ReactNode } from 'react';
import { cx } from '../cx';

/** The art's coordinate space. */
export const W = 480;
export const H = 270;

/** Deterministic PRNG (mulberry32) seeded from a string. */
export function seeded(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GameArtSpec {
  gameId: string;
  accent: GameAccent;
  motif: GameArtMotif;
}

export const artId = (gameId: string) => `gp-art-${gameId}`;

/** A region of the art (in its 480×270 space) so repeated cards show different details. */
export interface ArtCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Deterministic crop for a seed (e.g. an item id): the same item always shows the same detail. */
export function artCrop(seed: string): ArtCrop {
  const rng = seeded(seed);
  const w = 200 + Math.round(rng() * 80);
  const h = Math.round(w * 0.75);
  return { x: Math.round(rng() * (W - w)), y: Math.round(rng() * (H - h)), w, h };
}

/** The game's art filling its (positioned) parent, optionally zoomed into a crop. Decorative. */
export function GameArt({
  gameId,
  crop,
  className,
}: {
  gameId: string;
  crop?: ArtCrop;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={crop ? `${crop.x} ${crop.y} ${crop.w} ${crop.h}` : undefined}
      preserveAspectRatio="xMidYMid slice"
      className={cx('pointer-events-none absolute inset-0 h-full w-full', className)}
    >
      <use href={`#${artId(gameId)}`} width={crop ? W : '100%'} height={crop ? H : '100%'} />
    </svg>
  );
}

const MARK_SIZES = {
  sm: 'size-9 rounded-lg text-[11px]',
  md: 'size-12 rounded-xl text-sm',
  lg: 'size-16 rounded-2xl text-lg',
} as const;

export interface GameMarkProps {
  gameId: string;
  /** Short name drawn on the art, e.g. "원신". */
  label: string;
  size?: keyof typeof MARK_SIZES;
  className?: string;
}

/** Square game mark: the game's art and short name, readable at a glance. Decorative. */
export function GameMark({ gameId, label, size = 'md', className }: GameMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/10',
        MARK_SIZES[size],
        className,
      )}
    >
      <GameArt gameId={gameId} />
      <span className="absolute inset-0 bg-black/25" />
      <span
        className={cx(
          'font-title relative leading-none text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]',
          label.length > 2 && 'text-[0.8em]',
        )}
      >
        {label}
      </span>
    </span>
  );
}

export interface GameCoverProps {
  gameId: string;
  crop?: ArtCrop;
  className?: string;
  /** Darkening under overlaid text: "bottom" for titles at the bottom, "full" for dense overlays. */
  scrim?: 'bottom' | 'full' | 'none';
  children?: ReactNode;
}

/** The game's art as a banner with overlaid content (title cards, heroes, card headers). */
export function GameCover({ gameId, crop, className, scrim = 'bottom', children }: GameCoverProps) {
  return (
    <div className={cx('relative isolate overflow-hidden', className)}>
      <GameArt gameId={gameId} crop={crop} />
      {scrim === 'none' ? null : (
        <div
          aria-hidden="true"
          className={cx(
            'absolute inset-0',
            scrim === 'bottom'
              ? 'bg-gradient-to-t from-black/75 via-black/25 to-transparent'
              : 'bg-black/45',
          )}
        />
      )}
      {children ? <div className="relative h-full">{children}</div> : null}
    </div>
  );
}
