import { getModels } from '@/lib/mongodb';
import { withGame } from '@/lib/game-filter';
import { computeSimDatesFromMap, type SimComputed } from '@/lib/sort-sims';

export type { SimComputed };

export async function buildPlayDateMap(agentId?: string) {
  const { Game } = await getModels();
  const filter = await withGame(agentId ? { agentId } : {});

  const games = await Game.find(filter)
    .select('agentId sessionId date createdAt')
    .sort({ createdAt: -1 });

  const map = new Map<string, Date>();

  for (const g of games) {
    const key = `${g.agentId.toString()}:${g.sessionId}`;
    if (!map.has(key)) {
      const playedAt = g.createdAt
        ? new Date(g.createdAt)
        : new Date(`${g.date}T00:00:00`);
      map.set(key, playedAt);
    }
  }
  return map;
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

export function computeSimDates(
  agentId: string,
  sessionId: number,
  playMap: Map<string, Date>,
  overrides?: ReturnType<typeof simOverrides>
) {
  return computeSimDatesFromMap(agentId, sessionId, playMap, overrides);
}

export function enrichSimWithDates(
  agentId: string,
  simObj: {
    sessionId: number;
    lastPlayedAtOverride?: Date | null;
    nextPlayingAtOverride?: Date | null;
  },
  playMap: Map<string, Date>
): SimComputed {
  return computeSimDates(agentId, simObj.sessionId, playMap, simOverrides(simObj));
}

export async function getNextSessionId(agentId: string): Promise<number> {
  const { SimCard } = await getModels();
  const filter = await withGame({ agentId });
  const latest = await SimCard.findOne(filter).sort({ sessionId: -1 }).select('sessionId');
  return latest ? latest.sessionId + 1 : 1;
}

export async function getAvailableSims(agentId?: string) {
  const { SimCard } = await getModels();
  const filter = await withGame(agentId ? { agentId } : {});

  const [sims, playMap] = await Promise.all([
    SimCard.find(filter).populate('agentId', 'name').sort({ sessionId: 1 }),
    buildPlayDateMap(agentId),
  ]);

  return sims.filter((sim) => {
    const obj = sim.toObject();
    const dates = enrichSimWithDates(sim.agentId.toString(), obj, playMap);
    return dates.isAvailable;
  });
}

export async function getAgentSessionIds(agentId: string): Promise<number[]> {
  const { SimCard } = await getModels();
  const filter = await withGame({ agentId });
  const sims = await SimCard.find(filter).select('sessionId');
  return [...new Set(sims.map((s) => s.sessionId))].sort((a, b) => a - b);
}
