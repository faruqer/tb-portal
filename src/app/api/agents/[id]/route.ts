import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession, hashPassword } from '@/lib/auth';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const { Agent } = await getModels();
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
  const { Agent } = await getModels();

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
  const { Agent, SimCard, Game } = await getModels();
  await Promise.all([
    Agent.findByIdAndDelete(id),
    SimCard.deleteMany({ agentId: id }),
    Game.deleteMany({ agentId: id }),
  ]);
  return jsonOk({ ok: true });
}
