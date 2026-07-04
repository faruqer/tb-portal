import { connectDB } from '@/lib/mongodb';
import { SimCard } from '@/models/SimCard';
import { Game } from '@/models/Game';
import { computeSimDatesFromMap, type SimComputed } from '@/lib/sort-sims';

export type { SimComputed };

export async function buildPlayDateMap(agentId?: string) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (agentId) filter.agentId = agentId;

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

export function computeSimDates(
  agentId: string,
  sessionId: number,
  playMap: Map<string, Date>
): SimComputed {
  return computeSimDatesFromMap(agentId, sessionId, playMap);
}

export async function getNextSessionId(agentId: string): Promise<number> {
  await connectDB();
  const latest = await SimCard.findOne({ agentId }).sort({ sessionId: -1 }).select('sessionId');
  return latest ? latest.sessionId + 1 : 1;
}

export async function getAvailableSims(agentId?: string) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (agentId) filter.agentId = agentId;

  const [sims, playMap] = await Promise.all([
    SimCard.find(filter).populate('agentId', 'name').sort({ sessionId: 1 }),
    buildPlayDateMap(agentId),
  ]);

  return sims.filter((sim) => {
    const dates = computeSimDates(sim.agentId.toString(), sim.sessionId, playMap);
    return dates.isAvailable;
  });
}

export async function getAgentSessionIds(agentId: string): Promise<number[]> {
  await connectDB();
  const sims = await SimCard.find({ agentId }).select('sessionId');
  return [...new Set(sims.map((s) => s.sessionId))].sort((a, b) => a - b);
}
