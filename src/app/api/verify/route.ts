import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { roundAmount } from '@/lib/calculations';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { VerificationRequest } = await getModels();
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  const filter: Record<string, unknown> = {};
  if (agentId) filter.agentId = agentId;

  const requests = await VerificationRequest.find(filter)
    .populate('agentId', 'name')
    .populate('gameId')
    .sort({ createdAt: -1 });

  return jsonOk(
    requests.map((r) => {
      const obj = r.toObject();
      const agent = obj.agentId as { _id?: { toString(): string }; name?: string };
      const game = obj.gameId as Record<string, unknown> | null;
      return {
        ...serializeDoc(obj),
        agentId: agent?._id?.toString?.() ?? obj.agentId?.toString?.(),
        agentName: agent?.name,
        submittedAmount: obj.amount,
        game: game && game._id ? serializeDoc(game as never) : null,
      };
    })
  );
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await req.json();
  const { id, action, received } = body || {};
  if (!id || !action) return jsonError('id and action required');

  const { VerificationRequest, Game } = await getModels();
  const request = await VerificationRequest.findById(id);
  if (!request) return jsonError('Request not found', 404);

  const game = await Game.findById(request.gameId);
  if (!game) return jsonError('Game not found', 404);

  if (action === 'approve') {
    const receivedAmount = received !== undefined ? Number(received) : request.amount;
    if (!Number.isFinite(receivedAmount) || receivedAmount < 0) {
      return jsonError('Valid received amount required');
    }
    request.status = 'approved';
    game.paymentStatus = 'paid';
    game.received = roundAmount(receivedAmount);
    game.completed = 'completed';
    game.compite = 'completed';
    game.idStatus = 'sent';
    await game.save();
  } else if (action === 'reject') {
    request.status = 'rejected';
    game.paymentStatus = 'unpaid';
  } else if (action === 'revert') {
    if (request.status !== 'approved') {
      return jsonError('Only approved payments can be reverted');
    }
    request.status = 'pending';
    game.paymentStatus = 'pending_verify';
    game.received = 0;
    game.completed = 'pending';
    game.compite = 'pending';
    game.idStatus = 'pending';
    await game.save();
  } else {
    return jsonError('Invalid action');
  }

  await request.save();
  return jsonOk({ request: serializeDoc(request.toObject()), game: serializeDoc(game.toObject()) });
}
