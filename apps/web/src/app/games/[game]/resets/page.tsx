import { GameTabPage } from '@/components/game/game-tab-page';
import { ResetList } from '@/components/game/reset-list';
import { ko } from '@/lib/i18n';
import { getGameData } from '@/server/content';
import { gameFromParam, gameStaticParams, gameTabMetadata, type GameParams } from '@/server/games';

export const revalidate = 300;

export function generateStaticParams() {
  return gameStaticParams();
}

export function generateMetadata({ params }: { params: GameParams }) {
  return gameTabMetadata(params, 'resets');
}

export default async function GameResetsPage({ params }: { params: GameParams }) {
  const { game: slug } = await params;
  const game = gameFromParam(slug);
  const data = await getGameData(game.gameId);
  return (
    <GameTabPage game={game} tab="resets">
      <ResetList resets={data.resets} generatedAt={data.generatedAt} detailed />
      <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
        {ko.resets.explanation}
      </p>
    </GameTabPage>
  );
}
