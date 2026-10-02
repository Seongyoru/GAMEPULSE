import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { AnalyticsListener } from '@/components/analytics-listener';
import { SampleDataBanner } from '@/components/layout/sample-banner';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ko } from '@/lib/i18n';
import { MY_GAMES_BOOT_SCRIPT, myGamesCss } from '@/lib/my-games-boot';
import { isSampleDataMode } from '@/server/content';
import { ga4MeasurementId, siteUrl } from '@/server/env';
import './globals.css';

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: ko.meta.homeTitle, template: '%s | GAMEPULSE' },
    description: ko.site.description,
    applicationName: 'GAMEPULSE',
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: { siteName: 'GAMEPULSE', locale: 'ko_KR', type: 'website' },
    // Sample-data deployments (previews) must never be indexed.
    ...(isSampleDataMode() ? { robots: { index: false, follow: false } } : {}),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c11' },
  ],
  colorScheme: 'light dark',
};

function Ga4({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(measurementId)});`}
      </Script>
    </>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const ga4 = ga4MeasurementId();
  return (
    // data-mg is set by the boot script before React hydrates (see lib/my-games-boot.ts).
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MY_GAMES_BOOT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: myGamesCss() }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          {ko.nav.skip}
        </a>
        <SiteHeader />
        {isSampleDataMode() ? <SampleDataBanner /> : null}
        <main id="main" className="mx-auto min-h-[60vh] max-w-6xl px-4 pb-16">
          {children}
        </main>
        <SiteFooter />
        <AnalyticsListener />
        {ga4 ? <Ga4 measurementId={ga4} /> : null}
      </body>
    </html>
  );
}
