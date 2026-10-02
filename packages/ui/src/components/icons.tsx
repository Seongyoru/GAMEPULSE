/** One icon per content type, so a card's kind reads before its text. Decorative. */
import type { ContentType } from '@gamepulse/domain';
import {
  Dices,
  Gift,
  Megaphone,
  PartyPopper,
  ScrollText,
  Sparkles,
  Ticket,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../cx';

export const CONTENT_TYPE_ICONS: Readonly<Record<ContentType, LucideIcon>> = {
  PATCH: ScrollText,
  UPDATE: Sparkles,
  EVENT: PartyPopper,
  REWARD: Gift,
  REDEEM_CODE: Ticket,
  MAINTENANCE: Wrench,
  BANNER: Dices,
  ANNOUNCEMENT: Megaphone,
};

export function TypeIcon({ type, className }: { type: ContentType; className?: string }) {
  const Icon = CONTENT_TYPE_ICONS[type];
  return (
    <Icon aria-hidden="true" strokeWidth={2.2} className={cx('size-3.5 shrink-0', className)} />
  );
}
