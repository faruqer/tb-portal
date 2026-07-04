import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getSession, hashPassword } from '@/lib/auth';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';
import { Agent } from '@/models/Agent';

export async function GET() {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  await connectDB();
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

  await connectDB();
  const existing = await Agent.findOne({ username: String(username).toLowerCase().trim() });
  if (existing) return jsonError('Username already exists');

  const agent = await Agent.create({
    name: String(name).trim(),
    username: String(username).toLowerCase().trim(),
    passwordHash: await hashPassword(String(password)),
  });

  const obj = agent.toObject();
  return jsonOk({ ...serializeDoc(obj), passwordHash: undefined }, 201);
}
