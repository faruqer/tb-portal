import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { calcNetProfit, calcExpectedToReceive, parseSessionId, roundAmount } from '@/lib/calculations';
import { withGame, gameScope, gameFromParam, currentGameType } from '@/lib/game-filter';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';
import { getAgentSessionIds, getAvailableSims, setSimLastPlayed } from '@/lib/sim-service';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { Game } = await getModels();
  const { searchParams } = new URL(req.url);
  const completed = searchParams.get('completed');
  const agentFilter = searchParams.get('agentId');
  const paymentStatus = searchParams.get('paymentStatus');
  const gameParam = searchParams.get('game');
  const gameKey =
    gameParam === 'all'
      ? ('all' as const)
      : gameFromParam(gameParam) ?? (session.role === 'agent' ? ('all' as const) : undefined);

  const filter: Record<string, unknown> = {};
  if (session.role === 'agent') {
    filter.agentId = session.agentId;
  } else if (agentFilter) {
    filter.agentId = agentFilter;
  }
  if (completed === 'true') filter.completed = 'completed';
  if (completed === 'false') filter.completed = 'pending';
  if (paymentStatus === 'paid' || paymentStatus === 'unpaid') {
    filter.paymentStatus = paymentStatus;
  }

  const games = await Game.find(await withGame(filter, gameKey))
    .populate('agentId', 'name')
    .sort({ date: -1, createdAt: -1 });

  return jsonOk(
    games.map((g) => {
      const obj = g.toObject();
      const agent = obj.agentId as { _id?: { toString(): string }; name?: string } | string;
      return {
        ...serializeDoc(obj),
        agentId: typeof agent === 'object' && agent?._id ? agent._id.toString() : obj.agentId?.toString?.(),
        agentName: typeof agent === 'object' ? agent.name : undefined,
      };
    })
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await req.json();
  const { gameName, sessionId, agentId, wonProfit, date, expectedToReceive, gameType } = body || {};

  if (!agentId) return jsonError('Agent is required');

  const scopeKey = gameFromParam(gameType) ?? (await currentGameType());
  if (scopeKey === 'all') return jsonError('Game type (35k or 20k) is required');

  const sid = sessionId !== undefined ? parseSessionId(sessionId) : parseSessionId(gameName);
  if (!sid && sid !== 0) return jsonError('Session ID is required');

  const { Game } = await getModels();
  const availableSims = await getAvailableSims(agentId, scopeKey);
  const availableIds = new Set(availableSims.map((s) => s.sessionId));
  if (!availableIds.has(sid)) {
    return jsonError('Session is not available yet (7-day cooldown)');
  }

  const ownedSessions = await getAgentSessionIds(agentId);
  if (ownedSessions.length > 0 && !ownedSessions.includes(sid)) {
    return jsonError('Session ID not found for this agent');
  }

  const won = Number(wonProfit) || 0;
  const net = calcNetProfit(won);
  const expected = expectedToReceive !== undefined ? Number(expectedToReceive) : calcExpectedToReceive(net);

  const game = await Game.create({
    gameName: String(sid),
    sessionId: sid,
    agentId,
    wonProfit: won,
    netProfit: net,
    expectedToReceive: expected,
    received: 0,
    date: date || new Date().toISOString().slice(0, 10),
    compite: 'pending',
    idStatus: 'pending',
    completed: 'pending',
    paymentStatus: 'unpaid',
    ...(await gameScope(scopeKey)),
  });

  await setSimLastPlayed(agentId, sid, scopeKey, new Date());

  return jsonOk(serializeDoc(game.toObject()), 201);
}
