import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { parseSessionId, normalizeGroupId } from '@/lib/calculations';
import { currentGameType } from '@/lib/game-filter';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';
import { enrichSimWithDates, enrichSimBothGames, getAvailableSims, getNextSessionId } from '@/lib/sim-service';

function mapSimResponse(
  obj: Record<string, unknown>,
  agentId: string,
  gameType: Awaited<ReturnType<typeof currentGameType>>
) {
  const agent = obj.agentId as { _id?: { toString(): string }; name?: string };
  const aid = agent?._id?.toString?.() ?? agentId;
  const dates = enrichSimWithDates(obj as never, gameType);
  return {
    ...serializeDoc(obj as never),
    agentId: aid,
    agentName: agent?.name,
    groupId: obj.groupId ?? null,
    ...dates,
  };
}

function mapSimResponseBoth(obj: Record<string, unknown>, agentId: string) {
  const agent = obj.agentId as { _id?: { toString(): string }; name?: string };
  const aid = agent?._id?.toString?.() ?? agentId;
  const both = enrichSimBothGames(obj as never);
  const toIso = (v: unknown) => (v ? new Date(v as string | Date).toISOString() : null);
  return {
    ...serializeDoc(obj as never),
    agentId: aid,
    agentName: agent?.name,
    groupId: obj.groupId ?? null,
    next35kAt: both['35k'].nextPlayingAt,
    next35kReady: both['35k'].isAvailable,
    next35kAtOverride: toIso(obj.nextPlaying35kAtOverride),
    next20kAt: both['20k'].nextPlayingAt,
    next20kReady: both['20k'].isAvailable,
    next20kAtOverride: toIso(obj.nextPlaying20kAtOverride),
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const availableOnly = searchParams.get('available') === 'true';
  const agentId = searchParams.get('agentId');
  const bothGames = searchParams.get('both') === 'true';
  const gameType = await currentGameType();

  if (availableOnly) {
    const filterAgentId = session.role === 'agent' ? session.agentId : agentId || undefined;
    const sims = await getAvailableSims(filterAgentId, gameType);
    return jsonOk(
      sims.map((s) => {
        const obj = s.toObject();
        const agent = obj.agentId as { _id?: { toString(): string }; name?: string };
        const aid = agent?._id?.toString?.() ?? obj.agentId?.toString?.();
        return mapSimResponse(obj as never, aid, gameType);
      })
    );
  }

  const { SimCard } = await getModels();
  const filter: Record<string, unknown> = {};
  if (session.role === 'agent') {
    filter.agentId = session.agentId;
  } else if (agentId) {
    filter.agentId = agentId;
  }

  const sims = await SimCard.find(filter).populate('agentId', 'name').sort({ sessionId: 1 });

  return jsonOk(
    sims.map((s) => {
      const obj = s.toObject();
      const agent = obj.agentId as { _id?: { toString(): string }; name?: string };
      const aid = agent?._id?.toString?.() ?? obj.agentId?.toString?.();
      if (bothGames) return mapSimResponseBoth(obj as never, aid);
      return mapSimResponse(obj as never, aid, gameType);
    })
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await req.json();
  const { agentId, phoneNumber, sessionId, groupId } = body || {};

  if (!agentId || !phoneNumber?.trim()) {
    return jsonError('Agent and phone number are required');
  }

  const { SimCard } = await getModels();
  const sid =
    sessionId !== undefined && sessionId !== null && sessionId !== ''
      ? parseSessionId(sessionId)
      : await getNextSessionId(agentId);

  const sim = await SimCard.create({
    agentId,
    phoneNumber: String(phoneNumber).trim(),
    sessionId: sid,
    groupId: normalizeGroupId(groupId),
  });

  return jsonOk(serializeDoc(sim.toObject()), 201);
}
