import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getModels } from '@/lib/mongodb';
import { getSession, hashPassword } from '@/lib/auth';

import { calcNetProfit, calcExpectedToReceive, parseSessionId } from '@/lib/calculations';
import { withGame, gameScope } from '@/lib/game-filter';
import { jsonOk, jsonError, requireAdmin } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const dataDir = body.dataDir || path.join(process.cwd(), '..', 'data');

  const { Agent, Game, SimCard } = await getModels();
  const scope = await gameScope();

  const existingAgents = await Agent.countDocuments(await withGame());
  if (existingAgents > 0 && !body.force) {
    return jsonError('Database already has data. Pass force:true to re-import.');
  }

  const [agentsRaw, gamesRaw, completedRaw, simsRaw] = await Promise.all([
    readFile(path.join(dataDir, 'agents.json'), 'utf-8').catch(() => '[]'),
    readFile(path.join(dataDir, 'games.json'), 'utf-8').catch(() => '[]'),
    readFile(path.join(dataDir, 'completed-games.json'), 'utf-8').catch(() => '[]'),
    readFile(path.join(dataDir, 'phone-numbers.json'), 'utf-8').catch(() => '[]'),
  ]);

  const agentsJson = JSON.parse(agentsRaw) as { id: string; name: string; createdAt?: string }[];
  const gamesJson = [
    ...JSON.parse(gamesRaw),
    ...JSON.parse(completedRaw),
  ] as Record<string, unknown>[];
  const simsJson = JSON.parse(simsRaw) as Record<string, unknown>[];

  if (body.force) {
    const gameFilter = await withGame();
    await Promise.all([
      Agent.deleteMany(gameFilter),
      Game.deleteMany(gameFilter),
      SimCard.deleteMany(gameFilter),
    ]);
  }

  const agentMap = new Map<string, string>();

  for (const a of agentsJson) {
    const username = a.name.toLowerCase().replace(/[^a-z0-9]/g, '') || `agent${a.id.slice(0, 6)}`;
    const agent = await Agent.create({
      legacyId: a.id,
      name: a.name,
      username,
      passwordHash: await hashPassword('changeme123'),
      ...scope,
    });
    agentMap.set(a.id, agent._id.toString());
  }

  for (const g of gamesJson) {
    const agentLegacyId = g.agentId as string;
    const agentId = agentMap.get(agentLegacyId);
    if (!agentId) continue;

    const won = Number(g.wonProfit) || 0;
    const net = calcNetProfit(won);
    const expected = g.expectedToReceive !== undefined ? Number(g.expectedToReceive) : calcExpectedToReceive(net);

    await Game.create({
      legacyId: g.id as string,
      gameName: String(g.gameName || ''),
      sessionId: parseSessionId(String(g.gameName || '0')),
      agentId,
      wonProfit: won,
      netProfit: net,
      expectedToReceive: expected,
      received: Number(g.received) || 0,
      date: String(g.date || new Date().toISOString().slice(0, 10)),
      compite: g.compite === 'completed' ? 'completed' : 'pending',
      idStatus: g.idStatus === 'sent' ? 'sent' : 'pending',
      completed: g.completed === 'completed' ? 'completed' : 'pending',
      paymentStatus: Number(g.received) > 0 ? 'paid' : 'unpaid',
      createdAt: g.createdAt ? new Date(String(g.createdAt)) : new Date(),
      ...scope,
    });
  }

  for (const s of simsJson) {
    const agentLegacyId = s.agentId as string;
    const agentId = agentMap.get(agentLegacyId);
    if (!agentId) continue;

    await SimCard.create({
      legacyId: s.id as string,
      agentId,
      phoneNumber: String(s.phoneNumber || ''),
      sessionId: parseSessionId(String(s.profileName || '0')),
      createdAt: s.createdAt ? new Date(String(s.createdAt)) : new Date(),
      ...scope,
    });
  }

  return jsonOk({
    ok: true,
    agents: agentsJson.length,
    games: gamesJson.length,
    sims: simsJson.length,
    note: 'Default agent password is changeme123',
  });
}
