import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/auth';
import { getModels } from '@/lib/mongodb';
import { jsonOk, jsonError, requireAdmin } from '@/lib/api-utils';
import {
  parseSessionPayload,
  sessionIdFromFilename,
  type SessionUploadInput,
  type SessionUploadResult,
} from '@/lib/session-import';

export async function POST(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const agentId = typeof body?.agentId === 'string' ? body.agentId : '';
  const sessions = Array.isArray(body?.sessions) ? (body.sessions as SessionUploadInput[]) : [];

  if (!agentId || !mongoose.Types.ObjectId.isValid(agentId)) {
    return jsonError('Valid agentId is required');
  }
  if (sessions.length === 0) {
    return jsonError('Select at least one session JSON file');
  }

  const { Agent, SimCard } = await getModels();
  const agent = await Agent.findById(agentId).select('_id name username');
  if (!agent) return jsonError('Agent not found', 404);

  const results: SessionUploadResult[] = [];
  let updated = 0;
  let failed = 0;

  for (const item of sessions) {
    const filename = typeof item.filename === 'string' ? item.filename : 'unknown.json';

    if (item.error) {
      results.push({
        filename,
        sessionId: null,
        phoneNumber: null,
        ok: false,
        message: item.error,
      });
      failed++;
      continue;
    }

    const sessionId = sessionIdFromFilename(filename);
    if (sessionId === null) {
      results.push({
        filename,
        sessionId: null,
        phoneNumber: null,
        ok: false,
        message: 'Filename must include session index, e.g. yonas (1).json',
      });
      failed++;
      continue;
    }

    const { token, phone } = parseSessionPayload(item.data);
    if (!token || !phone) {
      results.push({
        filename,
        sessionId,
        phoneNumber: phone,
        ok: false,
        message: 'Missing SRBNtoken or SRBNphone in file',
      });
      failed++;
      continue;
    }

    const sim = await SimCard.findOne({ agentId: agent._id, sessionId });
    if (!sim) {
      results.push({
        filename,
        sessionId,
        phoneNumber: phone,
        ok: false,
        message: `No SIM card for session ${sessionId} — add it in Agents first`,
      });
      failed++;
      continue;
    }

    sim.sessionToken = token;
    await sim.save();

    results.push({
      filename,
      sessionId,
      phoneNumber: phone,
      ok: true,
      message: `Session ${sessionId} saved (${phone})`,
    });
    updated++;
  }

  console.log(
    `[session-upload] agent=${agent.name} files=${sessions.length} updated=${updated} failed=${failed}`
  );

  return jsonOk({
    agentId,
    agentName: agent.name,
    updated,
    failed,
    total: sessions.length,
    results,
  });
}
