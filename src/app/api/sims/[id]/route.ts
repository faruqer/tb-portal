import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { parseSessionId, normalizeGroupId } from '@/lib/calculations';
import { withGame } from '@/lib/game-filter';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { SimCard } = await getModels();

  const sim = await SimCard.findOne(await withGame({ _id: id }));
  if (!sim) return jsonError('SIM not found', 404);

  if (body.phoneNumber !== undefined) sim.phoneNumber = String(body.phoneNumber).trim();
  if (body.sessionId !== undefined) sim.sessionId = parseSessionId(body.sessionId);
  if (body.groupId !== undefined) sim.groupId = normalizeGroupId(body.groupId);
  if (body.lastPlayedAt !== undefined) {
    sim.lastPlayedAtOverride = body.lastPlayedAt ? new Date(body.lastPlayedAt) : null;
  }
  if (body.nextPlayingAt !== undefined) {
    sim.nextPlayingAtOverride = body.nextPlayingAt ? new Date(body.nextPlayingAt) : null;
  }

  await sim.save();
  return jsonOk(serializeDoc(sim.toObject()));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const { SimCard } = await getModels();
  await SimCard.findOneAndDelete(await withGame({ _id: id }));
  return jsonOk({ ok: true });
}
