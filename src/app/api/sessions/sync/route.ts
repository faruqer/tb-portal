import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/auth';
import { getModels } from '@/lib/mongodb';
import { jsonOk, jsonError, requireAdmin } from '@/lib/api-utils';
import {
  isKeepAliveSuccess,
  keepAliveMessage,
  summarizeSyncResults,
} from '@/lib/session-sync';
import { sendSessionKeepAlive } from '@/lib/session-sync-server';

export const maxDuration = 60;

async function getSyncItems(agentId?: string) {
  const { SimCard } = await getModels();
  const filter: Record<string, unknown> = {
    sessionToken: { $exists: true, $nin: [null, ''] },
  };

  if (agentId) {
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      console.warn(`[session-sync] invalid agentId: ${agentId}`);
      return [];
    }
    filter.agentId = new mongoose.Types.ObjectId(agentId);
  }

  const sims = await SimCard.find(filter)
    .populate('agentId', 'name lastSessionSyncAt username')
    .sort({ agentId: 1, sessionId: 1 });

  console.log(`[session-sync] queue agentId=${agentId ?? 'all'} found=${sims.length} sim(s)`);

  return sims.map((sim) => {
    const agent = sim.agentId as {
      _id?: { toString(): string };
      name?: string;
      username?: string;
      lastSessionSyncAt?: Date | null;
    };
    const aid = agent?._id?.toString?.() ?? sim.agentId.toString();
    return {
      simId: sim._id.toString(),
      agentId: aid,
      agentName: agent?.name ?? 'Unknown',
      agentUsername: agent?.username ?? '',
      sessionId: sim.sessionId,
      phoneNumber: sim.phoneNumber,
      sessionToken: sim.sessionToken as string,
      agentLastSyncAt: agent?.lastSessionSyncAt?.toISOString?.() ?? null,
    };
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId') || undefined;
  const items = await getSyncItems(agentId);

  const { Agent, SimCard } = await getModels();
  const agents = await Agent.find()
    .select('_id name username lastSessionSyncAt')
    .sort({ name: 1 });

  const tokenCounts = await SimCard.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { sessionToken: { $exists: true, $nin: [null, ''] } } },
    { $group: { _id: '$agentId', count: { $sum: 1 } } },
  ]);
  const countByAgent = new Map(tokenCounts.map((r) => [r._id.toString(), r.count]));

  const lastSyncByAgent: Record<string, string | null> = {};
  const agentOptions = agents.map((a) => {
    const id = a._id.toString();
    lastSyncByAgent[id] = a.lastSessionSyncAt?.toISOString?.() ?? null;
    return {
      id,
      name: a.name,
      username: a.username,
      lastSessionSyncAt: lastSyncByAgent[id],
      tokenCount: countByAgent.get(id) ?? 0,
    };
  });

  const lastSyncedAt = agentId
    ? lastSyncByAgent[agentId] ?? null
    : agents.reduce<string | null>((latest, a) => {
        const iso = a.lastSessionSyncAt?.toISOString?.();
        if (!iso) return latest;
        if (!latest || iso > latest) return iso;
        return latest;
      }, null);

  return jsonOk({
    items: items.map(({ sessionToken: _t, ...rest }) => rest),
    lastSyncedAt,
    lastSyncByAgent,
    agents: agentOptions,
    total: items.length,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const simId = typeof body.simId === 'string' ? body.simId : undefined;
  const markAgentComplete = body.markAgentComplete === true;
  const agentId = typeof body.agentId === 'string' ? body.agentId : undefined;

  if (markAgentComplete && agentId) {
    const { Agent } = await getModels();
    const now = new Date();
    await Agent.findByIdAndUpdate(agentId, { lastSessionSyncAt: now });
    console.log(`[session-sync] marked agent complete agentId=${agentId} at=${now.toISOString()}`);
    return jsonOk({ agentId, syncedAt: now.toISOString() });
  }

  if (!simId) {
    return jsonError('simId is required');
  }

  const { SimCard } = await getModels();
  const sim = await SimCard.findById(simId).populate('agentId', 'name username');
  if (!sim) {
    console.warn(`[session-sync] sim not found simId=${simId}`);
    return jsonError('SIM not found', 404);
  }
  if (!sim.sessionToken) {
    console.warn(`[session-sync] sim missing token simId=${simId} session=${sim.sessionId}`);
    return jsonError('SIM has no session token. Run npm run import-sessions.', 404);
  }

  const agent = sim.agentId as { _id?: { toString(): string }; name?: string; username?: string };
  const aid = agent?._id?.toString?.() ?? sim.agentId.toString();

  console.log(
    `[session-sync] syncing simId=${simId} agent=${agent?.name ?? aid} session=${sim.sessionId} phone=${sim.phoneNumber}`
  );

  const { response, httpStatus, error } = await sendSessionKeepAlive(sim.sessionToken as string);
  const success = isKeepAliveSuccess(response);
  const message = keepAliveMessage(response, httpStatus);

  console.log(
    `[session-sync] result simId=${simId} session=${sim.sessionId} http=${httpStatus} ok=${success} msg=${message}`
  );

  const result = {
    simId,
    agentId: aid,
    agentName: agent?.name ?? 'Unknown',
    sessionId: sim.sessionId,
    phoneNumber: sim.phoneNumber,
    response,
    httpStatus,
    success,
    message,
    debug: error
      ? `Fetch error: ${error}`
      : `HTTP ${httpStatus} · token ${String(sim.sessionToken).slice(0, 12)}… · ${JSON.stringify(response)}`,
  };

  const summary = summarizeSyncResults([{ ...result, response }]);

  return jsonOk({
    ...result,
    ok: summary.ok,
    failed: summary.failed,
  });
}
