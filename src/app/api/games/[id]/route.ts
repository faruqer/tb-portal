import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { calcNetProfit, calcExpectedToReceive } from '@/lib/calculations';
import { withGame, gameScope } from '@/lib/game-filter';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { id } = await params;
  const body = await req.json();
  const { Game, VerificationRequest } = await getModels();

  const game = await Game.findOne(await withGame({ _id: id }));
  if (!game) return jsonError('Game not found', 404);

  if (session.role === 'agent') {
    if (game.agentId.toString() !== session.agentId) {
      return jsonError('Forbidden', 403);
    }
    if (body.action === 'mark_paid') {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonError('Please enter the amount you sent');
      }
      if (game.paymentStatus === 'paid') {
        return jsonError('Already marked as paid');
      }
      game.paymentStatus = 'pending_verify';
      await game.save();

      const existing = await VerificationRequest.findOne(await withGame({ gameId: id, status: 'pending' }));
      if (existing) {
        existing.amount = amount;
        await existing.save();
      } else {
        await VerificationRequest.create({
          gameId: id,
          agentId: game.agentId,
          amount,
          status: 'pending',
          ...(await gameScope()),
        });
      }
      return jsonOk(serializeDoc(game.toObject()));
    }
    return jsonError('Agents can only mark games as paid');
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
  const { Game, VerificationRequest } = await getModels();
  await Promise.all([
    Game.findOneAndDelete(await withGame({ _id: id })),
    VerificationRequest.deleteMany(await withGame({ gameId: id })),
  ]);
  return jsonOk({ ok: true });
}
