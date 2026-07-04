import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { parseSessionId, normalizeGroupId } from '@/lib/calculations';
import { jsonOk, jsonError, requireAdmin, serializeDoc } from '@/lib/api-utils';
import { buildPlayDateMap, computeSimDates, getAvailableSims } from '@/lib/sim-service';
import { SimCard } from '@/models/SimCard';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  await connectDB();
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
        const dates = computeSimDates(aid, obj.sessionId, playMap);
        return {
          ...serializeDoc(obj),
          agentId: aid,
          agentName: agent?.name,
          groupId: obj.groupId ?? null,
          ...dates,
        };
      })
    );
  }

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
      const dates = computeSimDates(aid, obj.sessionId, playMap);
      return {
        ...serializeDoc(obj),
        agentId: aid,
        agentName: agent?.name,
        groupId: obj.groupId ?? null,
        ...dates,
      };
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

  await connectDB();
  const sim = await SimCard.create({
    agentId,
    phoneNumber: String(phoneNumber).trim(),
    sessionId: parseSessionId(sessionId ?? 0),
    groupId: normalizeGroupId(groupId),
  });

  return jsonOk(serializeDoc(sim.toObject()), 201);
}
