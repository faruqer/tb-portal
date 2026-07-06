import { getGameKey } from '@/lib/game-context';
import type { GameKey } from '@/lib/games';

export async function currentGameType(): Promise<GameKey> {
  return getGameKey();
}

/** Merge active game tab into a MongoDB filter */
export async function withGame(filter: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return { ...filter, gameType: await getGameKey() };
}

/** Fields to set when creating documents */
export async function gameScope(): Promise<{ gameType: GameKey }> {
  return { gameType: await getGameKey() };
}
