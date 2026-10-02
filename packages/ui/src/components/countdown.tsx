'use client';

import {
  formatClockDuration,
  formatCompactDateTime,
  formatDDay,
  formatRemaining,
} from '@gamepulse/domain';
import { cx } from '../cx';
import { useLiveNow } from '../clock';

export interface CountdownProps {
  /** ISO instant counted down to. */
  target: string;
  timeZone: string;
  locale?: string;
  /** auto: clock under 24h, D-day beyond · clock: always HH:MM:SS · dday: always D-n */
  mode?: 'auto' | 'clock' | 'dday';
  /** Shown once the target has passed. */
  expiredLabel?: string;
  /** Date-only facts must never display a time of day. */
  precision?: 'DATETIME' | 'DATE';
  className?: string;
}

/**
 * Live countdown. Renders the absolute target time on the server and during hydration
 * (stable markup, no layout shift), then switches to a ticking value. Uses the shared
 * second ticker only while showing a clock; D-day labels use the minute ticker.
 */
export function Countdown({
  target,
  timeZone,
  locale = 'ko-KR',
  mode = 'auto',
  expiredLabel = '종료',
  precision = 'DATETIME',
  className,
}: CountdownProps) {
  const targetMs = Date.parse(target);
  const needsSeconds = precision === 'DATETIME' && mode !== 'dday';
  const now = useLiveNow(needsSeconds ? 'second' : 'minute');
  const absolute =
    precision === 'DATE'
      ? formatCompactDateTime(target, timeZone, locale).slice(0, -6)
      : formatCompactDateTime(target, timeZone, locale);

  let text = absolute;
  if (now !== null) {
    const nowDate = new Date(now);
    if (targetMs <= now) text = expiredLabel;
    else if (mode === 'clock' && precision === 'DATETIME')
      text = formatClockDuration(targetMs - now);
    else if (mode === 'dday' || precision === 'DATE') text = formatDDay(target, nowDate, timeZone);
    else text = formatRemaining(target, nowDate, timeZone) ?? expiredLabel;
  }

  return (
    <time
      dateTime={target}
      title={absolute}
      className={cx('inline-block min-w-[8ch] font-mono tabular-nums', className)}
    >
      {text}
    </time>
  );
}
