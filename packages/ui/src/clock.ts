'use client';

/**
 * Shared clocks. One interval per resolution drives every live component, and components
 * subscribe through useSyncExternalStore so only the components that display time re-render.
 *
 * During server rendering and hydration the "server snapshot" is used (the page's generation
 * time, or null), so markup always matches; live values take over right after hydration.
 */
import { useSyncExternalStore } from 'react';

export type ClockResolution = 'second' | 'minute';

const PERIOD: Readonly<Record<ClockResolution, number>> = { second: 1000, minute: 60_000 };

interface Ticker {
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
}

const tickers: Record<ClockResolution, Ticker> = {
  second: { listeners: new Set(), timer: null },
  minute: { listeners: new Set(), timer: null },
};

function subscribeTo(resolution: ClockResolution) {
  return (listener: () => void) => {
    const ticker = tickers[resolution];
    ticker.listeners.add(listener);
    if (ticker.timer === null) {
      ticker.timer = setInterval(() => {
        for (const notify of ticker.listeners) notify();
      }, PERIOD[resolution]);
    }
    return () => {
      ticker.listeners.delete(listener);
      if (ticker.listeners.size === 0 && ticker.timer !== null) {
        clearInterval(ticker.timer);
        ticker.timer = null;
      }
    };
  };
}

const subscribers: Record<ClockResolution, (listener: () => void) => () => void> = {
  second: subscribeTo('second'),
  minute: subscribeTo('minute'),
};

/** Current time truncated to the resolution, so snapshots are stable within a tick. */
function snapshot(resolution: ClockResolution): number {
  const period = PERIOD[resolution];
  return Math.floor(Date.now() / period) * period;
}

const getSecond = () => snapshot('second');
const getMinute = () => snapshot('minute');

/**
 * Live epoch milliseconds at the given resolution. `serverNow` is used for SSR and hydration
 * (pass the page's generation time).
 */
export function useNow(resolution: ClockResolution, serverNow: number): number {
  return useSyncExternalStore(
    subscribers[resolution],
    resolution === 'second' ? getSecond : getMinute,
    () => serverNow,
  );
}

/** Like useNow, but null until hydrated — for components that render a static fallback. */
export function useLiveNow(resolution: ClockResolution): number | null {
  return useSyncExternalStore<number | null>(
    subscribers[resolution],
    resolution === 'second' ? getSecond : getMinute,
    () => null,
  );
}
