import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { gameFromParam, currentGameType } from '@/lib/game-filter';
import { jsonOk, requireAdmin } from '@/lib/api-utils';
import { getAgentSessionIds, getAvailableSims } from '@/lib/sim-service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const availableOnly = searchParams.get('available') === 'true';

  if (availableOnly) {
    const scopeKey = gameFromParam(searchParams.get('game')) ?? (await currentGameType());
    const gameType = scopeKey === 'all' ? await currentGameType() : scopeKey;
    const sims = await getAvailableSims(id, gameType);
    const sessionIds = [...new Set(sims.map((s) => s.sessionId))].sort((a, b) => a - b);
    return jsonOk(sessionIds);
  }

  const sessions = await getAgentSessionIds(id);
  return jsonOk(sessions);
}
