import { CalendarView } from '@/components/calendar/calendar-view';
import { ko } from '@/lib/i18n';
import { getDashboardData } from '@/server/content';
import { pageMetadata } from '@/server/seo';

export const revalidate = 300;

export const metadata = pageMetadata({
  title: ko.calendar.title,
  description: ko.calendar.description,
  path: '/calendar',
});

export default async function CalendarPage() {
  const data = await getDashboardData();
  return (
    <div className="space-y-6 pt-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">CALENDAR</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
          {ko.calendar.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{ko.calendar.description}</p>
      </header>
      <CalendarView items={data.items} resets={data.resets} generatedAt={data.generatedAt} />
    </div>
  );
}
