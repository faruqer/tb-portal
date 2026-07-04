import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { parseSessionId, normalizeGroupId } from '@/lib/calculations';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';
import { SimCard } from '@/models/SimCard';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  await connectDB();

  const sim = await SimCard.findById(id);
  if (!sim) return jsonError('SIM not found', 404);

  if (body.phoneNumber !== undefined) sim.phoneNumber = String(body.phoneNumber).trim();
  if (body.sessionId !== undefined) sim.sessionId = parseSessionId(body.sessionId);
  if (body.groupId !== undefined) sim.groupId = normalizeGroupId(body.groupId);

  await sim.save();
  return jsonOk(serializeDoc(sim.toObject()));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  await connectDB();
  await SimCard.findByIdAndDelete(id);
  return jsonOk({ ok: true });
}
