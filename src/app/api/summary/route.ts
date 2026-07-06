import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { jsonOk, requireAuth } from '@/lib/api-utils';
import type { GameTotals } from '@/lib/types';
import { addDaysStr } from '@/lib/calculations';
import { resolveAgentId, emptyTotals, addToTotals } from '@/lib/game-utils';
import { withGame } from '@/lib/game-filter';
import { buildPlayDateMap, enrichSimWithDates } from '@/lib/sim-service';

function getWeekStart(d: Date): string {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy.toISOString().slice(0, 10);
}

function sumGames(
  games: { wonProfit?: number; netProfit?: number; expectedToReceive?: number; received?: number }[]
): GameTotals {
  return games.reduce<GameTotals>(
    (acc, g) => addToTotals(acc, g),
    emptyTotals()
  );
}

function bucketKey(dateStr: string, period: 'day' | 'week' | 'month'): string {
  if (period === 'month') return dateStr.slice(0, 7);
  if (period === 'week') return getWeekStart(new Date(dateStr + 'T00:00:00'));
  return dateStr.slice(0, 10);
}

function buildChartLabels(period: 'day' | 'week' | 'month'): string[] {
  const labels: string[] = [];
  const today = new Date();

  if (period === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      labels.push(d.toISOString().slice(0, 10));
    }
  } else if (period === 'week') {
    for (let i = 7; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      labels.push(getWeekStart(d));
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      labels.push(d.toISOString().slice(0, 7));
    }
  }
  return labels;
}

function formatChartLabel(label: string, period: 'day' | 'week' | 'month'): string {
  if (period === 'month') {
    const [y, m] = label.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(m) - 1]} ${y.slice(2)}`;
  }
  if (period === 'week') return `W ${label.slice(5)}`;
  return label.slice(5);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const denied = requireAuth(session);
  if (denied) return denied;

  const { Game, SimCard, Agent } = await getModels();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const agentId = searchParams.get('agentId');
  const type = searchParams.get('type') || 'general';

  const filter: Record<string, unknown> = {};
  if (session!.role === 'agent') {
    filter.agentId = session!.agentId;
  } else if (agentId) {
    filter.agentId = agentId;
  }
  if (date) filter.date = date;

  const games = await Game.find(await withGame(filter)).populate('agentId', 'name');
  const totals = sumGames(games);

  if (type === 'today-progress') {
    const today = new Date().toISOString().slice(0, 10);
    const wonToday = await Game.countDocuments(await withGame({ date: today }));
    const totalSims = await SimCard.countDocuments(await withGame());
    const expectedToday = totalSims / 7;
    return jsonOk({ today, wonToday, totalSims, expectedToday });
  }

  if (type === 'sims') {
    const simFilter: Record<string, unknown> = {};
    if (session!.role === 'agent') simFilter.agentId = session!.agentId;
    else if (agentId) simFilter.agentId = agentId;

    const sims = await SimCard.find(await withGame(simFilter));
    const playMap = await buildPlayDateMap(
      agentId || (session!.role === 'agent' ? session!.agentId : undefined)
    );
    let available = 0;
    for (const s of sims) {
      const dates = enrichSimWithDates(s.agentId.toString(), s.toObject(), playMap);
      if (dates.isAvailable) available++;
    }
    return jsonOk({ total: sims.length, inUse: sims.length - available, free: available });
  }

  if (type === 'agent-sims') {
    const agents = await Agent.find(await withGame()).sort({ name: 1 });
    const sims = await SimCard.find(await withGame());
    const playMap = await buildPlayDateMap();
    const summary = agents.map((agent) => {
      const agentSims = sims.filter((s) => s.agentId.toString() === agent._id.toString());
      let free = 0;
      for (const s of agentSims) {
        if (enrichSimWithDates(agent._id.toString(), s.toObject(), playMap).isAvailable) free++;
      }
      return {
        agentId: agent._id.toString(),
        agentName: agent.name,
        totalSims: agentSims.length,
        inUse: agentSims.length - free,
        free,
      };
    });
    return jsonOk(summary);
  }

  if (type === 'chart') {
    const period = (searchParams.get('period') || 'week') as 'day' | 'week' | 'month';
    const labels = buildChartLabels(period);
    const buckets: Record<string, GameTotals> = {};

    for (const g of games) {
      const key = bucketKey(g.date, period);
      if (!buckets[key]) buckets[key] = emptyTotals();
      buckets[key] = addToTotals(buckets[key], g);
    }

    return jsonOk({
      period,
      labels: labels.map((l) => formatChartLabel(l, period)),
      rawLabels: labels,
      series: {
        won: labels.map((l) => buckets[l]?.wonProfit ?? 0),
        net: labels.map((l) => buckets[l]?.netProfit ?? 0),
        expected: labels.map((l) => buckets[l]?.expectedToReceive ?? 0),
        received: labels.map((l) => buckets[l]?.received ?? 0),
      },
    });
  }

  if (type === 'weekly') {
    const weekStart = searchParams.get('weekStart') || getWeekStart(new Date());
    const weekEnd = addDaysStr(weekStart, 6);
    const weekGames = games.filter((g) => g.date >= weekStart && g.date <= weekEnd);
    const byDay: Record<string, GameTotals> = {};
    for (const g of weekGames) {
      const d = g.date.slice(0, 10);
      if (!byDay[d]) byDay[d] = emptyTotals();
      byDay[d] = addToTotals(byDay[d], g);
    }
    return jsonOk({ weekStart, weekEnd, byDay, totals: sumGames(weekGames) });
  }

  if (type === 'monthly') {
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const monthGames = games.filter((g) => (g.date || '').startsWith(month));
    const byDay: Record<string, GameTotals> = {};
    for (const g of monthGames) {
      const d = g.date.slice(0, 10);
      if (!byDay[d]) byDay[d] = emptyTotals();
      byDay[d] = addToTotals(byDay[d], g);
    }
    return jsonOk({ month, byDay, totals: sumGames(monthGames) });
  }

  if (type === 'by-agent' && session!.role === 'admin') {
    const agents = await Agent.find(await withGame());
    const byAgent = agents.map((agent) => {
      const agentIdStr = agent._id.toString();
      const agentGames = games.filter((g) => resolveAgentId(g.agentId) === agentIdStr);
      return { agentId: agentIdStr, agentName: agent.name, totals: sumGames(agentGames) };
    });
    return jsonOk(byAgent);
  }

  return jsonOk({ date: date || 'all', totals, games: games.length });
}
