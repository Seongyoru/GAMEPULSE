import { toPulseItem } from '@gamepulse/domain';
import { EmptyState } from '@gamepulse/ui';
import { GameTabPage } from '@/components/game/game-tab-page';
import { PulseItemCard } from '@/components/pulse-item-card';
import { ko } from '@/lib/i18n';
import { getGamePatches } from '@/server/content';
import { gameFromParam, gameStaticParams, gameTabMetadata, type GameParams } from '@/server/games';

export const revalidate = 300;

export function generateStaticParams() {
  return gameStaticParams();
}

export function generateMetadata({ params }: { params: GameParams }) {
  return gameTabMetadata(params, 'patches');
}

export default async function GamePatchesPage({ params }: { params: GameParams }) {
  const { game: slug } = await params;
  const game = gameFromParam(slug);
  const { generatedAt, records } = await getGamePatches(game.gameId);
  const patches = records.map(toPulseItem);
  const serverNow = Date.parse(generatedAt);
  return (
    <GameTabPage game={game} tab="patches">
      {patches.length === 0 ? (
        <EmptyState title={ko.game.noPatches} />
      ) : (
        <div className="grid gap-2" data-testid="patch-list">
          {patches.map((item) => (
            <PulseItemCard key={item.id} item={item} serverNow={serverNow} />
          ))}
        </div>
      )}
    </GameTabPage>
  );
}
