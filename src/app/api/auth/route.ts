import { NextRequest } from 'next/server';
import { getGameKey } from '@/lib/game-context';
import {
  createToken,
  setSessionCookie,
  clearSessionCookie,
  verifyAdmin,
  verifyAgentCredentials,
  getSession,
} from '@/lib/auth';
import { jsonOk, jsonError } from '@/lib/api-utils';
import { getGameLabel } from '@/lib/games';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, password } = body || {};

  if (!username || !password) {
    return jsonError('Username and password are required', 400);
  }

  const creds = { u: String(username), p: String(password) };

  if (await verifyAdmin(creds.u, creds.p)) {
    const token = await createToken({ role: 'admin', username: creds.u });
    await setSessionCookie(token);
    const gameKey = await getGameKey();
    return jsonOk({ ok: true, role: 'admin', game: gameKey, gameLabel: getGameLabel(gameKey) });
  }

  const agent = await verifyAgentCredentials(creds.u, creds.p);
  if (agent) {
    const token = await createToken({
      role: 'agent',
      username: agent.username,
      agentName: agent.agentName,
    });
    await setSessionCookie(token);
    const gameKey = await getGameKey();
    return jsonOk({ ok: true, role: 'agent', agentName: agent.agentName, game: gameKey, gameLabel: getGameLabel(gameKey) });
  }

  return jsonError('Invalid credentials', 401);
}

export async function DELETE() {
  await clearSessionCookie();
  return jsonOk({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);
  const gameKey = await getGameKey();
  return jsonOk({ ok: true, ...session, game: gameKey, gameLabel: getGameLabel(gameKey) });
}
