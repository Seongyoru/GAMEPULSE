/**
 * Static class maps (Tailwind must see full class names in source). Colours are semantic:
 * game accents identify games; tones communicate urgency. Never decorative.
 */
import type { GameAccent, PatchChangeType } from '@gamepulse/domain';

export interface AccentClasses {
  dot: string;
  text: string;
  soft: string;
  border: string;
  bar: string;
}

export const ACCENT_CLASSES: Readonly<Record<GameAccent, AccentClasses>> = {
  sky: {
    dot: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-300',
    soft: 'bg-sky-500/10',
    border: 'border-sky-500/40',
    bar: 'bg-sky-500',
  },
  amber: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    soft: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    bar: 'bg-amber-500',
  },
  orange: {
    dot: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-300',
    soft: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    bar: 'bg-orange-500',
  },
  teal: {
    dot: 'bg-teal-500',
    text: 'text-teal-700 dark:text-teal-300',
    soft: 'bg-teal-500/10',
    border: 'border-teal-500/40',
    bar: 'bg-teal-500',
  },
  violet: {
    dot: 'bg-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
    soft: 'bg-violet-500/10',
    border: 'border-violet-500/40',
    bar: 'bg-violet-500',
  },
  rose: {
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-300',
    soft: 'bg-rose-500/10',
    border: 'border-rose-500/40',
    bar: 'bg-rose-500',
  },
  lime: {
    dot: 'bg-lime-500',
    text: 'text-lime-700 dark:text-lime-300',
    soft: 'bg-lime-500/10',
    border: 'border-lime-500/40',
    bar: 'bg-lime-500',
  },
  indigo: {
    dot: 'bg-indigo-500',
    text: 'text-indigo-700 dark:text-indigo-300',
    soft: 'bg-indigo-500/10',
    border: 'border-indigo-500/40',
    bar: 'bg-indigo-500',
  },
};

export const TONES = [
  'urgent',
  'soon',
  'live',
  'upcoming',
  'ended',
  'neutral',
  'info',
  'sample',
] as const;
export type Tone = (typeof TONES)[number];

export const TONE_CLASSES: Readonly<Record<Tone, string>> = {
  urgent: 'bg-rose-500/12 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  soon: 'bg-amber-500/12 text-amber-800 ring-amber-500/30 dark:text-amber-300',
  live: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  upcoming: 'bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  ended: 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/25 dark:text-zinc-400',
  neutral: 'bg-zinc-500/10 text-zinc-700 ring-zinc-500/25 dark:text-zinc-300',
  info: 'bg-indigo-500/12 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300',
  sample: 'bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/30 dark:text-fuchsia-300',
};

export const CHANGE_TYPE_CLASSES: Readonly<Record<PatchChangeType, string>> = {
  BUFF: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  NERF: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  ADJUST: 'bg-amber-500/12 text-amber-800 dark:text-amber-300',
  NEW: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  REMOVED: 'bg-zinc-500/12 text-zinc-700 dark:text-zinc-300',
  REWORK: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  FIX: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
  SYSTEM: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
};
