import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession, hashPassword } from '@/lib/auth';
import { withGame, currentGameType } from '@/lib/game-filter';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const { Agent } = await getModels();
  const agent = await Agent.findOne(await withGame({ _id: id }));
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
  const gameType = await currentGameType();

  const agent = await Agent.findOne(await withGame({ _id: id }));
  if (!agent) return jsonError('Agent not found', 404);

  if (body.name) agent.name = String(body.name).trim();
  if (body.username) {
    const username = String(body.username).toLowerCase().trim();
    const existing = await Agent.findOne({ username, gameType, _id: { $ne: id } });
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
  const scope = await withGame({ agentId: id });
  await Promise.all([
    Agent.findOneAndDelete(await withGame({ _id: id })),
    SimCard.deleteMany(scope),
    Game.deleteMany(scope),
  ]);
  return jsonOk({ ok: true });
}
