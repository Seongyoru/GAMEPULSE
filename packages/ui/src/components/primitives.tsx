/**
 * Small presentational primitives (server-compatible).
 */
import type { GameAccent, RewardItem } from '@gamepulse/domain';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { ACCENT_CLASSES, TONE_CLASSES, type Tone } from '../tokens';

export interface GameBadgeProps {
  name: string;
  accent: GameAccent;
  href?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Game identity: accent dot + name. Never uses publisher artwork. */
export function GameBadge({ name, accent, href, size = 'sm', className }: GameBadgeProps) {
  const content = (
    <>
      <span
        aria-hidden
        className={cx(
          'inline-block shrink-0 rounded-full',
          ACCENT_CLASSES[accent].dot,
          size === 'sm' ? 'size-2' : 'size-2.5',
        )}
      />
      <span className="truncate">{name}</span>
    </>
  );
  const classes = cx(
    'inline-flex min-w-0 items-center gap-1.5 font-semibold tracking-tight',
    size === 'sm' ? 'text-xs' : 'text-sm',
    ACCENT_CLASSES[accent].text,
    className,
  );
  return href ? (
    <Link href={href} className={cx(classes, 'hover:underline')}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}

export interface StatusChipProps {
  tone: Tone;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function StatusChip({ tone, children, className, title }: StatusChipProps) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '';
  return ` ×${quantity.toLocaleString('ko-KR')}${unit ? unit : ''}`;
}

export interface RewardBadgeProps {
  items: readonly RewardItem[];
  max?: number;
  className?: string;
}

/** "원석 ×420 · 영웅의 경험 ×10개" */
export function RewardBadge({ items, max = 3, className }: RewardBadgeProps) {
  if (items.length === 0) return null;
  const shown = items.slice(0, max);
  return (
    <span
      className={cx(
        'inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted',
        className,
      )}
    >
      {shown.map((item, index) => (
        <span key={`${item.name}-${index}`} className="whitespace-nowrap">
          <span className="font-medium text-text">{item.name}</span>
          <span className="tabular-nums">{formatQuantity(item.quantity, item.unit)}</span>
        </span>
      ))}
      {items.length > max ? <span>+{items.length - max}</span> : null}
    </span>
  );
}

export interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  count?: number;
  action?: ReactNode;
  id?: string;
}

export function SectionHeader({ eyebrow, title, count, action, id }: SectionHeaderProps) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
        <h2
          id={id}
          className="flex items-baseline gap-2 text-lg font-bold tracking-tight text-text"
        >
          {title}
          {count !== undefined ? (
            <span className="text-sm font-semibold tabular-nums text-muted">{count}</span>
          ) : null}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'section' | 'li';
}) {
  return (
    <Tag className={cx('rounded-lg border border-border bg-surface', className)}>{children}</Tag>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'rounded-lg border border-dashed border-border px-4 py-8 text-center',
        className,
      )}
    >
      <p className="font-semibold text-text">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded bg-zinc-500/15', className)} />;
}

export type AdSlotMode = 'off' | 'placeholder';

export interface AdSlotProps {
  placement: string;
  mode: AdSlotMode;
  /** Reserved height so a future ad never shifts layout. */
  height?: number;
  label?: string;
  className?: string;
}

/**
 * Reserved advertising placement. No provider is integrated: "off" renders nothing,
 * "placeholder" renders a clearly-labelled reserved box of fixed height (no layout shift).
 */
export function AdSlot({
  placement,
  mode,
  height = 100,
  label = '광고 영역',
  className,
}: AdSlotProps) {
  if (mode === 'off') return null;
  return (
    <aside
      aria-label={label}
      data-ad-placement={placement}
      style={{ minHeight: height }}
      className={cx(
        'flex items-center justify-center rounded-lg border border-dashed border-border text-[11px] uppercase tracking-widest text-muted',
        className,
      )}
    >
      {label} · {placement}
    </aside>
  );
}
