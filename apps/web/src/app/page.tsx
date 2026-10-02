import Link from 'next/link';
import { JsonLdScript } from '@/components/content/json-ld';
import { HomePulse } from '@/components/home/home-pulse';
import { ko } from '@/lib/i18n';
import { getDashboardData } from '@/server/content';
import { pageMetadata, websiteJsonLd } from '@/server/seo';

export const revalidate = 300;

export const metadata = pageMetadata({
  title: ko.meta.homeTitle,
  description: ko.site.description,
  path: '/',
  absoluteTitle: true,
});

export default async function HomePage() {
  const data = await getDashboardData();
  const t = ko.home;
  return (
    <>
      <JsonLdScript data={websiteJsonLd()} />
      <section className="py-10 sm:py-14" aria-labelledby="home-hero">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">GAMEPULSE</p>
        <h1
          id="home-hero"
          className="mt-2 whitespace-pre-line text-4xl font-black leading-[1.05] tracking-tight text-text sm:text-6xl"
        >
          {t.heroTitle}
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">{t.heroSubtitle}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/my-games"
            className="rounded-md bg-text px-4 py-2.5 text-sm font-bold text-bg hover:opacity-90"
            data-testid="hero-choose-games"
          >
            {t.chooseGames}
          </Link>
          <Link
            href="/today"
            className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-bold text-text hover:border-zinc-400"
          >
            {t.openToday}
          </Link>
        </div>
      </section>
      <HomePulse items={data.items} resets={data.resets} generatedAt={data.generatedAt} />
    </>
  );
}
