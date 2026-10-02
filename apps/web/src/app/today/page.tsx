import { TodayDashboard } from '@/components/today/today-dashboard';
import { ko } from '@/lib/i18n';
import { getDashboardData } from '@/server/content';
import { adsMode } from '@/server/env';
import { pageMetadata } from '@/server/seo';

export const revalidate = 300;

export const metadata = pageMetadata({
  title: ko.meta.todayTitle,
  description: ko.meta.todayDescription,
  path: '/today',
});

/** Static/ISR shell; personalization (MY GAMES, dismissed items, live countdowns) is client-side. */
export default async function TodayPage() {
  const data = await getDashboardData();
  return (
    <TodayDashboard
      items={data.items}
      resets={data.resets}
      generatedAt={data.generatedAt}
      adsMode={adsMode()}
    />
  );
}
