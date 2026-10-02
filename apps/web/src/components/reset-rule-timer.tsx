import { describeSchedule, type ResetRuleDefinition } from '@gamepulse/domain';
import { ResetTimer, StatusChip } from '@gamepulse/ui';
import { ko } from '@/lib/i18n';
import { gameViewById, VIEWER_TIMEZONE, zoneLabel } from '@/lib/present';

/** One reset rule with a live countdown to its next occurrence. */
export function ResetRuleTimer({
  rule,
  nextAt,
  showGame = true,
  className,
}: {
  rule: ResetRuleDefinition;
  nextAt: string;
  showGame?: boolean;
  className?: string;
}) {
  const game = gameViewById(rule.gameId);
  return (
    <ResetTimer
      name={rule.name}
      nextAt={nextAt}
      timeZone={VIEWER_TIMEZONE}
      description={describeSchedule(rule, 'ko-KR')}
      zoneLabel={zoneLabel(rule.timezone)}
      game={
        showGame ? { gameId: game.gameId, name: game.shortName, accent: game.accent } : undefined
      }
      className={className}
      badge={
        rule.verification === 'UNVERIFIED' ? (
          <StatusChip tone="neutral" title={ko.resets.explanation}>
            {ko.resets.verificationPending}
          </StatusChip>
        ) : (
          <StatusChip tone="info">{ko.resets.verified}</StatusChip>
        )
      }
    />
  );
}
