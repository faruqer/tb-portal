import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession, hashPassword } from '@/lib/auth';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';

export async function GET() {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { Agent } = await getModels();
  const agents = await Agent.find().sort({ name: 1 });
  return jsonOk(agents.map((a) => ({ ...serializeDoc(a.toObject()), passwordHash: undefined })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await req.json();
  const { name, username, password } = body || {};

  if (!name?.trim() || !username?.trim() || !password) {
    return jsonError('Name, username, and password are required');
  }

  const { Agent } = await getModels();
  const normalized = String(username).toLowerCase().trim();
  const existing = await Agent.findOne({ username: normalized });
  if (existing) return jsonError('Username already exists');

  const agent = await Agent.create({
    name: String(name).trim(),
    username: normalized,
    passwordHash: await hashPassword(String(password)),
  });

  return jsonOk({ ...serializeDoc(agent.toObject()), passwordHash: undefined }, 201);
}
