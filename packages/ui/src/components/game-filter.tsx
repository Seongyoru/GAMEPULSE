'use client';

import type { GameAccent } from '@gamepulse/domain';
import { Check } from 'lucide-react';
import { cx } from '../cx';
import { ACCENT_CLASSES } from '../tokens';
import { GameArt } from './game-art';

export interface GameFilterOption {
  gameId: string;
  name: string;
  accent: GameAccent;
}

export interface GameFilterProps {
  games: readonly GameFilterOption[];
  selected: readonly string[];
  onToggle: (gameId: string) => void;
  label: string;
  className?: string;
}

/** Toggle chips for games (MY GAMES selection, calendar filters). */
export function GameFilter({ games, selected, onToggle, label, className }: GameFilterProps) {
  return (
    <div role="group" aria-label={label} className={cx('flex flex-wrap gap-2', className)}>
      {games.map((game) => {
        const active = selected.includes(game.gameId);
        return (
          <button
            key={game.gameId}
            type="button"
            aria-pressed={active}
            data-game-toggle={game.gameId}
            onClick={() => onToggle(game.gameId)}
            className={cx(
              'inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500',
              active
                ? cx(
                    ACCENT_CLASSES[game.accent].soft,
                    ACCENT_CLASSES[game.accent].border,
                    'text-text',
                  )
                : 'border-border bg-surface text-muted hover:text-text',
            )}
          >
            <span
              aria-hidden
              className={cx(
                'relative grid size-7 place-items-center overflow-hidden rounded-full ring-1 ring-black/10 transition',
                !active && 'opacity-45 grayscale',
              )}
            >
              <GameArt gameId={game.gameId} />
              {active ? (
                <Check className="relative size-4 text-white drop-shadow" strokeWidth={3} />
              ) : null}
            </span>
            {game.name}
          </button>
        );
      })}
    </div>
  );
}
