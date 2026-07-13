import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { calcNetProfit, calcExpectedToReceive, roundAmount } from '@/lib/calculations';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';
import { refreshSimLastPlayed } from '@/lib/sim-service';
import type { GameKey } from '@/lib/games';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { id } = await params;
  const body = await req.json();
  const { Game } = await getModels();

  const game = await Game.findById(id);
  if (!game) return jsonError('Game not found', 404);

  if (session.role === 'agent') {
    if (game.agentId.toString() !== session.agentId) {
      return jsonError('Forbidden', 403);
    }
    return jsonError('Agents cannot edit games');
  }

  if (body.action === 'mark_paid') {
    game.paymentStatus = 'paid';
    game.received = roundAmount(Number(body.received ?? game.expectedToReceive));
    game.completed = 'completed';
    game.compite = 'completed';
    game.idStatus = 'sent';
    await game.save();
    return jsonOk(serializeDoc(game.toObject()));
  }

  if (body.action === 'mark_unpaid') {
    game.paymentStatus = 'unpaid';
    game.received = 0;
    game.completed = 'pending';
    game.compite = 'pending';
    game.idStatus = 'pending';
    await game.save();
    return jsonOk(serializeDoc(game.toObject()));
  }

  const won = body.wonProfit !== undefined ? Number(body.wonProfit) : game.wonProfit;
  const net = calcNetProfit(won);

  if (body.sessionId !== undefined || body.gameName !== undefined) {
    const sid = Number(body.sessionId ?? body.gameName);
    game.sessionId = sid;
    game.gameName = String(sid);
  }
  if (body.wonProfit !== undefined) {
    game.wonProfit = won;
    game.netProfit = net;
    if (body.expectedToReceive === undefined) {
      game.expectedToReceive = calcExpectedToReceive(net);
    }
  }
  if (body.expectedToReceive !== undefined) game.expectedToReceive = Number(body.expectedToReceive);
  if (body.date) game.date = body.date;

  await game.save();
  return jsonOk(serializeDoc(game.toObject()));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const { Game } = await getModels();
  const game = await Game.findById(id);
  if (!game) return jsonError('Game not found', 404);

  const agentId = game.agentId.toString();
  const sessionId = game.sessionId;
  const gameType = game.gameType as GameKey;

  await Game.findByIdAndDelete(id);
  await refreshSimLastPlayed(agentId, sessionId, gameType);
  return jsonOk({ ok: true });
}
