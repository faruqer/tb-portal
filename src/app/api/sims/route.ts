import { NextRequest } from 'next/server';
import { getModels } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { parseSessionId, normalizeGroupId } from '@/lib/calculations';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';
import { buildPlayDateMap, enrichSimWithDates, getAvailableSims, getNextSessionId } from '@/lib/sim-service';

function mapSimResponse(
  obj: Record<string, unknown>,
  agentId: string,
  playMap: Map<string, Date>
) {
  const agent = obj.agentId as { _id?: { toString(): string }; name?: string };
  const aid = agent?._id?.toString?.() ?? agentId;
  const dates = enrichSimWithDates(aid, obj as never, playMap);
  return {
    ...serializeDoc(obj as never),
    agentId: aid,
    agentName: agent?.name,
    groupId: obj.groupId ?? null,
    ...dates,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const availableOnly = searchParams.get('available') === 'true';
  const agentId = searchParams.get('agentId');

  if (availableOnly) {
    const filterAgentId = session.role === 'agent' ? session.agentId : agentId || undefined;
    const sims = await getAvailableSims(filterAgentId);
    const playMap = await buildPlayDateMap(filterAgentId);
    return jsonOk(
      sims.map((s) => {
        const obj = s.toObject();
        const agent = obj.agentId as { _id?: { toString(): string }; name?: string };
        const aid = agent?._id?.toString?.() ?? obj.agentId?.toString?.();
        return mapSimResponse(obj as never, aid, playMap);
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

  const [sims, playMap] = await Promise.all([
    SimCard.find(filter).populate('agentId', 'name').sort({ sessionId: 1 }),
    buildPlayDateMap(agentId || (session.role === 'agent' ? session.agentId : undefined)),
  ]);

  return jsonOk(
    sims.map((s) => {
      const obj = s.toObject();
      const agent = obj.agentId as { _id?: { toString(): string }; name?: string };
      const aid = agent?._id?.toString?.() ?? obj.agentId?.toString?.();
      return mapSimResponse(obj as never, aid, playMap);
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
