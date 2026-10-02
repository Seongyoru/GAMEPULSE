import { toPulseItem } from '@gamepulse/domain';
import { CalendarView } from '@/components/calendar/calendar-view';
import { GameTabPage } from '@/components/game/game-tab-page';
import { getGameData } from '@/server/content';
import { gameFromParam, gameStaticParams, gameTabMetadata, type GameParams } from '@/server/games';

export const revalidate = 300;

export function generateStaticParams() {
  return gameStaticParams();
}

export function generateMetadata({ params }: { params: GameParams }) {
  return gameTabMetadata(params, 'calendar');
}

export default async function GameCalendarPage({ params }: { params: GameParams }) {
  const { game: slug } = await params;
  const game = gameFromParam(slug);
  const data = await getGameData(game.gameId);
  return (
    <GameTabPage game={game} tab="calendar">
      <CalendarView
        items={data.records.map(toPulseItem)}
        resets={data.resets}
        generatedAt={data.generatedAt}
        fixedGameId={game.gameId}
      />
    </GameTabPage>
  );
}
