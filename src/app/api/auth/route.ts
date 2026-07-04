import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import {
  createToken,
  setSessionCookie,
  clearSessionCookie,
  verifyAdmin,
  getSession,
  comparePassword,
} from '@/lib/auth';
import { jsonOk, jsonError } from '@/lib/api-utils';
import { Agent } from '@/models/Agent';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, password, role } = body || {};

  if (!username || !password) {
    return jsonError('Username and password are required', 400);
  }

  if (role === 'admin') {
    const valid = await verifyAdmin(String(username), String(password));
    if (!valid) return jsonError('Invalid credentials', 401);

    const token = await createToken({ role: 'admin', username: String(username) });
    await setSessionCookie(token);
    return jsonOk({ ok: true, role: 'admin' });
  }

  await connectDB();
  const login = String(username).toLowerCase().trim();
  const agent = await Agent.findOne({
    $or: [{ username: login }, { name: { $regex: new RegExp(`^${login.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }],
  });
  if (!agent) return jsonError('Invalid credentials', 401);

  const valid = await comparePassword(String(password), agent.passwordHash);
  if (!valid) return jsonError('Invalid credentials', 401);

  const token = await createToken({
    role: 'agent',
    username: agent.username,
    agentId: agent._id.toString(),
    agentName: agent.name,
  });
  await setSessionCookie(token);
  return jsonOk({ ok: true, role: 'agent', agentName: agent.name });
}

export async function DELETE() {
  await clearSessionCookie();
  return jsonOk({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);
  return jsonOk({ ok: true, ...session });
}
