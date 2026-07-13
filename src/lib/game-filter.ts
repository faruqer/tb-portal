import { getGameKey } from '@/lib/game-context';
import { isGameKey, type GameKey } from '@/lib/games';

export type GameFilter = GameKey | 'all';

export async function currentGameType(): Promise<GameKey> {
  return getGameKey();
}

export function gameFromParam(value: string | null | undefined): GameFilter | undefined {
  if (value === 'all') return 'all';
  return isGameKey(value) ? value : undefined;
}

/** Merge game type into a MongoDB filter (games only). Pass `all` to include every game type. */
export async function withGame(
  filter: Record<string, unknown> = {},
  override?: GameFilter
): Promise<Record<string, unknown>> {
  if (override === 'all') return filter;
  const gameType = override ?? (await getGameKey());
  return { ...filter, gameType };
}

/** Fields to set when creating game documents */
export async function gameScope(override?: GameKey): Promise<{ gameType: GameKey }> {
  return { gameType: override ?? (await getGameKey()) };
}
