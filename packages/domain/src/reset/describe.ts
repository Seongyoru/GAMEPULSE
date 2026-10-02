import { weekdayLabel } from '../time/format';
import type { ResetSchedule } from './engine';
import { parseRRule, RRuleError } from './rrule';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Reference Monday used to look up weekday labels (2024-01-01 was a Monday). */
function weekdayName(isoWeekday: number, locale: string): string {
  return weekdayLabel({ year: 2024, month: 1, day: isoWeekday }, locale);
}

/** Human description of a reset schedule, e.g. "매주 수요일 06:00" / "Every Wed 06:00". */
export function describeSchedule(schedule: ResetSchedule, locale: string): string {
  const ko = locale.startsWith('ko');
  const time = `${pad2(schedule.hour)}:${pad2(schedule.minute)}`;
  const day = (iso: number) => (ko ? `${weekdayName(iso, locale)}요일` : weekdayName(iso, locale));
  const monthDay = (d: number) =>
    d === -1 ? (ko ? '말일' : 'last day') : ko ? `${d}일` : `day ${d}`;

  switch (schedule.frequency) {
    case 'DAILY':
      return ko ? `매일 ${time}` : `Daily ${time}`;
    case 'WEEKLY':
      return ko
        ? `매주 ${day(schedule.dayOfWeek ?? 1)} ${time}`
        : `Every ${day(schedule.dayOfWeek ?? 1)} ${time}`;
    case 'MONTHLY':
      return ko
        ? `매월 ${monthDay(schedule.dayOfMonth ?? 1)} ${time}`
        : `Monthly, ${monthDay(schedule.dayOfMonth ?? 1)} ${time}`;
    case 'CUSTOM_RRULE': {
      if (schedule.rrule === null) return ko ? '사용자 정의 일정' : 'Custom schedule';
      try {
        const rule = parseRRule(schedule.rrule);
        const hour = rule.byHour[0] ?? schedule.hour;
        const minute = rule.byMinute[0] ?? schedule.minute;
        const ruleTime = `${pad2(hour)}:${pad2(minute)}`;
        if (rule.freq === 'WEEKLY') {
          const days =
            rule.byDay.map((d) => day(d.weekday)).join('·') || day(schedule.dayOfWeek ?? 1);
          if (rule.interval === 2)
            return ko ? `격주 ${days} ${ruleTime}` : `Every other ${days} ${ruleTime}`;
          if (rule.interval === 1)
            return ko ? `매주 ${days} ${ruleTime}` : `Every ${days} ${ruleTime}`;
          return ko
            ? `${rule.interval}주마다 ${days} ${ruleTime}`
            : `Every ${rule.interval} weeks, ${days} ${ruleTime}`;
        }
        if (rule.freq === 'MONTHLY' && rule.byMonthDay.length > 0 && rule.interval === 1) {
          const days = rule.byMonthDay.map(monthDay).join('·');
          return ko ? `매월 ${days} ${ruleTime}` : `Monthly, ${days} ${ruleTime}`;
        }
        if (rule.freq === 'DAILY' && rule.interval === 1) {
          return ko ? `매일 ${ruleTime}` : `Daily ${ruleTime}`;
        }
      } catch (error) {
        if (!(error instanceof RRuleError)) throw error;
      }
      return ko ? '사용자 정의 일정' : 'Custom schedule';
    }
  }
}
