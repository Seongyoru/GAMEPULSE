import { toPulseItem, type ContentType } from '@gamepulse/domain';
import { GameTabPage } from '@/components/game/game-tab-page';
import { TimelineGroups } from '@/components/game/timeline-groups';
import { getGameData } from '@/server/content';
import { gameFromParam, gameStaticParams, gameTabMetadata, type GameParams } from '@/server/games';

export const revalidate = 300;

const TYPES: readonly ContentType[] = ['REWARD', 'REDEEM_CODE'];

export function generateStaticParams() {
  return gameStaticParams();
}

export function generateMetadata({ params }: { params: GameParams }) {
  return gameTabMetadata(params, 'rewards');
}

export default async function GameRewardsPage({ params }: { params: GameParams }) {
  const { game: slug } = await params;
  const game = gameFromParam(slug);
  const data = await getGameData(game.gameId);
  const items = data.records.filter((record) => TYPES.includes(record.type)).map(toPulseItem);
  return (
    <GameTabPage game={game} tab="rewards">
      <TimelineGroups items={items} generatedAt={data.generatedAt} />
    </GameTabPage>
  );
}
