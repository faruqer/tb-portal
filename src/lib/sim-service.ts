import { getModels } from '@/lib/mongodb';
import { currentGameType } from '@/lib/game-filter';
import { computeSimDates, type SimComputed } from '@/lib/sort-sims';
import type { GameKey } from '@/lib/games';

export type { SimComputed };

export function lastPlayedField(gameType: GameKey): 'lastPlayed35kAt' | 'lastPlayed20kAt' {
  return gameType === '35k' ? 'lastPlayed35kAt' : 'lastPlayed20kAt';
}

function simOverrides(obj: {
  lastPlayedAtOverride?: Date | null;
  nextPlayingAtOverride?: Date | null;
}) {
  const overrides: { lastPlayedAt?: Date; nextPlayingAt?: Date } = {};
  if (obj.lastPlayedAtOverride) overrides.lastPlayedAt = new Date(obj.lastPlayedAtOverride);
  if (obj.nextPlayingAtOverride) overrides.nextPlayingAt = new Date(obj.nextPlayingAtOverride);
  return overrides.lastPlayedAt || overrides.nextPlayingAt ? overrides : undefined;
}

export function enrichSimWithDates(
  simObj: {
    lastPlayed35kAt?: Date | null;
    lastPlayed20kAt?: Date | null;
    lastPlayedAtOverride?: Date | null;
    nextPlayingAtOverride?: Date | null;
  },
  gameType: GameKey
): SimComputed {
  const stored = simObj[lastPlayedField(gameType)];
  const lastPlayed = stored ? new Date(stored) : null;
  return computeSimDates(lastPlayed, simOverrides(simObj));
}

export function enrichSimBothGames(simObj: {
  lastPlayed35kAt?: Date | null;
  lastPlayed20kAt?: Date | null;
  lastPlayedAtOverride?: Date | null;
  nextPlayingAtOverride?: Date | null;
}) {
  return {
    '35k': enrichSimWithDates(simObj, '35k'),
    '20k': enrichSimWithDates(simObj, '20k'),
  };
}

export async function setSimLastPlayed(
  agentId: string,
  sessionId: number,
  gameType: GameKey,
  playedAt: Date
) {
  const { SimCard } = await getModels();
  await SimCard.findOneAndUpdate({ agentId, sessionId }, { [lastPlayedField(gameType)]: playedAt });
}

export async function refreshSimLastPlayed(agentId: string, sessionId: number, gameType: GameKey) {
  const { Game, SimCard } = await getModels();
  const latest = await Game.findOne({ agentId, sessionId, gameType })
    .sort({ createdAt: -1 })
    .select('createdAt date');

  const playedAt = latest
    ? latest.createdAt
      ? new Date(latest.createdAt)
      : new Date(`${latest.date}T00:00:00`)
    : null;

  await SimCard.findOneAndUpdate({ agentId, sessionId }, { [lastPlayedField(gameType)]: playedAt });
}

export async function getNextSessionId(agentId: string): Promise<number> {
  const { SimCard } = await getModels();
  const latest = await SimCard.findOne({ agentId }).sort({ sessionId: -1 }).select('sessionId');
  return latest ? latest.sessionId + 1 : 1;
}

export async function getAvailableSims(agentId?: string, gameType?: GameKey) {
  const gt = gameType ?? (await currentGameType());
  const { SimCard } = await getModels();
  const filter: Record<string, unknown> = {};
  if (agentId) filter.agentId = agentId;

  const sims = await SimCard.find(filter).populate('agentId', 'name').sort({ sessionId: 1 });

  return sims.filter((sim) => {
    const obj = sim.toObject();
    return enrichSimWithDates(obj, gt).isAvailable;
  });
}

export async function getAgentSessionIds(agentId: string): Promise<number[]> {
  const { SimCard } = await getModels();
  const sims = await SimCard.find({ agentId }).select('sessionId');
  return [...new Set(sims.map((s) => s.sessionId))].sort((a, b) => a - b);
}
