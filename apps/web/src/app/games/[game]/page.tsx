import { toPulseItem } from '@gamepulse/domain';
import { GameOverview } from '@/components/game/game-overview';
import { GameTabPage } from '@/components/game/game-tab-page';
import { getGameData } from '@/server/content';
import { gameFromParam, gameStaticParams, gameTabMetadata, type GameParams } from '@/server/games';

export const revalidate = 300;

export function generateStaticParams() {
  return gameStaticParams();
}

export function generateMetadata({ params }: { params: GameParams }) {
  return gameTabMetadata(params, 'overview');
}

export default async function GamePage({ params }: { params: GameParams }) {
  const { game: slug } = await params;
  const game = gameFromParam(slug);
  const data = await getGameData(game.gameId);
  return (
    <GameTabPage game={game} tab="overview">
      <GameOverview
        gameId={game.gameId}
        gameSlug={game.slug}
        items={data.records.map(toPulseItem)}
        resets={data.resets}
        generatedAt={data.generatedAt}
        lastUpdatedAt={data.lastUpdatedAt}
      />
    </GameTabPage>
  );
}
