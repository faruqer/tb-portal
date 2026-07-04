import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getSession, hashPassword } from '@/lib/auth';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';
import { Agent } from '@/models/Agent';
import { SimCard } from '@/models/SimCard';
import { Game } from '@/models/Game';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  await connectDB();
  const agent = await Agent.findById(id);
  if (!agent) return jsonError('Agent not found', 404);
  return jsonOk({ ...serializeDoc(agent.toObject()), passwordHash: undefined });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  await connectDB();

  const agent = await Agent.findById(id);
  if (!agent) return jsonError('Agent not found', 404);

  if (body.name) agent.name = String(body.name).trim();
  if (body.username) {
    const username = String(body.username).toLowerCase().trim();
    const existing = await Agent.findOne({ username, _id: { $ne: id } });
    if (existing) return jsonError('Username already exists');
    agent.username = username;
  }
  if (body.password) {
    agent.passwordHash = await hashPassword(String(body.password));
  }

  await agent.save();
  return jsonOk({ ...serializeDoc(agent.toObject()), passwordHash: undefined });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  await connectDB();
  await Promise.all([
    Agent.findByIdAndDelete(id),
    SimCard.deleteMany({ agentId: id }),
    Game.deleteMany({ agentId: id }),
  ]);
  return jsonOk({ ok: true });
}
