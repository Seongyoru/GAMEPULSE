import type { ReactNode } from 'react';
import { Breadcrumbs } from './breadcrumbs';

export interface PolicySection {
  title: string;
  body: ReactNode;
}

/** Shared frame of the policy pages (privacy, terms, data sources). */
export function PolicyPage({
  title,
  path,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  path: string;
  updatedAt: string;
  intro: ReactNode;
  sections: readonly PolicySection[];
}) {
  return (
    <article className="max-w-3xl space-y-6 pb-8">
      <Breadcrumbs
        items={[
          { name: '홈', path: '/' },
          { name: title, path },
        ]}
      />
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">{title}</h1>
        <p className="text-xs text-muted">
          최종 업데이트 <time dateTime={updatedAt}>{updatedAt}</time>
        </p>
        <div className="text-sm leading-relaxed text-muted">{intro}</div>
      </header>
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-base font-bold text-text">{section.title}</h2>
          <div className="space-y-2 text-sm leading-relaxed text-text/90">{section.body}</div>
        </section>
      ))}
    </article>
  );
}
