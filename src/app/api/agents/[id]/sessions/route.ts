import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { withGame } from '@/lib/game-filter';
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
    const { Game } = await getModels();
    const sims = await getAvailableSims(id);
    const activeGames = await Game.find(await withGame({ agentId: id, completed: 'pending' })).select(
      'sessionId'
    );
    const blocked = new Set(activeGames.map((g) => g.sessionId));
    const sessionIds = [...new Set(sims.map((s) => s.sessionId).filter((sid) => !blocked.has(sid)))].sort(
      (a, b) => a - b
    );
    return jsonOk(sessionIds);
  }

  const sessions = await getAgentSessionIds(id);
  return jsonOk(sessions);
}
