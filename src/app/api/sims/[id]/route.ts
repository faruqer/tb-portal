import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { parseSessionId, normalizeGroupId } from '@/lib/calculations';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { SimCard } = await getModels();

  const sim = await SimCard.findById(id);
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
  if (body.next35kAt !== undefined) {
    sim.nextPlaying35kAtOverride = body.next35kAt ? new Date(body.next35kAt) : null;
  }
  if (body.next20kAt !== undefined) {
    sim.nextPlaying20kAtOverride = body.next20kAt ? new Date(body.next20kAt) : null;
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
  await SimCard.findByIdAndDelete(id);
  return jsonOk({ ok: true });
}
