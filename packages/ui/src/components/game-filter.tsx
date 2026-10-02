'use client';

import type { GameAccent } from '@gamepulse/domain';
import { cx } from '../cx';
import { ACCENT_CLASSES } from '../tokens';

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
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
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
                'size-2 rounded-full',
                active ? ACCENT_CLASSES[game.accent].dot : 'bg-zinc-400/60',
              )}
            />
            {game.name}
          </button>
        );
      })}
    </div>
  );
}
