import type { GameTotals } from '@/lib/types';

export function resolveAgentId(agentId: unknown): string {
  if (!agentId) return '';
  if (typeof agentId === 'string') return agentId;
  if (typeof agentId === 'object' && agentId !== null && '_id' in agentId) {
    const id = (agentId as { _id?: { toString(): string } })._id;
    return id?.toString?.() ?? '';
  }
  return String(agentId);
}

export function emptyTotals(): GameTotals {
  return { wonProfit: 0, netProfit: 0, expectedToReceive: 0, received: 0, count: 0 };
}

export function addToTotals(totals: GameTotals, g: Partial<GameTotals>): GameTotals {
  return {
    wonProfit: totals.wonProfit + (g.wonProfit || 0),
    netProfit: totals.netProfit + (g.netProfit || 0),
    expectedToReceive: totals.expectedToReceive + (g.expectedToReceive || 0),
    received: totals.received + (g.received || 0),
    count: totals.count + 1,
  };
}
