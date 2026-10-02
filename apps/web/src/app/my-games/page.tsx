import { MyGamesEditor } from '@/components/my-games/my-games-editor';
import { ko } from '@/lib/i18n';
import { pageMetadata } from '@/server/seo';

export const metadata = pageMetadata({
  title: ko.meta.myGamesTitle,
  description: ko.myGames.description,
  path: '/my-games',
  noIndex: true,
});

export default function MyGamesPage() {
  return (
    <div className="max-w-2xl space-y-6 pt-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">MY GAMES</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
          {ko.myGames.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{ko.myGames.description}</p>
      </header>
      <MyGamesEditor />
    </div>
  );
}
