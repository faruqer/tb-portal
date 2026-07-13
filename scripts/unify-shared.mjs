/**
 * Unify agents & SIMs: one shared set for 35K and 20K.
 * - Remaps 20k games to 35k agent IDs (by username)
 * - Removes duplicate 20k agents/sims
 * - Drops gameType from agents/sims
 * Usage: npm run unify-shared
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

function loadEnv() {
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const val = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

async function main() {
  loadEnv();
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const agents = db.collection('agents');
  const sims = db.collection('simcards');
  const games = db.collection('games');

  const allAgents = await agents.find({}).toArray();
  const byUsername = new Map();
  for (const a of allAgents) {
    const key = a.username;
    const existing = byUsername.get(key);
    if (!existing || a.gameType === '35k') {
      byUsername.set(key, a);
    }
  }

  const idMap = new Map();
  for (const a of allAgents) {
    const keeper = byUsername.get(a.username);
    if (keeper) idMap.set(a._id.toString(), keeper._id);
  }

  console.log('Remapping 20k games to shared agent IDs…');
  const games20k = await games.find({ gameType: '20k' }).toArray();
  let remapped = 0;
  for (const g of games20k) {
    const newAgentId = idMap.get(g.agentId?.toString());
    if (newAgentId && !newAgentId.equals(g.agentId)) {
      await games.updateOne({ _id: g._id }, { $set: { agentId: newAgentId } });
      remapped++;
    }
  }
  console.log(`  Remapped ${remapped} game(s)`);

  const keeperIds = new Set([...byUsername.values()].map((a) => a._id.toString()));
  const dupAgents = allAgents.filter((a) => !keeperIds.has(a._id.toString()));
  if (dupAgents.length) {
    await agents.deleteMany({ _id: { $in: dupAgents.map((a) => a._id) } });
    console.log(`Removed ${dupAgents.length} duplicate agent(s)`);
  }

  const allSims = await sims.find({}).toArray();
  const simKeep = new Map();
  for (const s of allSims) {
    const aid = idMap.get(s.agentId?.toString())?.toString() ?? s.agentId?.toString();
    const key = `${aid}:${s.sessionId}`;
    const existing = simKeep.get(key);
    if (!existing || s.gameType === '35k') {
      simKeep.set(key, { ...s, agentId: idMap.get(s.agentId?.toString()) ?? s.agentId });
    }
  }

  await sims.deleteMany({});
  const simDocs = [...simKeep.values()].map(({ _id, gameType, ...rest }) => ({
    ...rest,
    agentId: rest.agentId,
  }));
  if (simDocs.length) await sims.insertMany(simDocs);
  console.log(`Unified to ${simDocs.length} SIM card(s)`);

  await agents.updateMany({}, { $unset: { gameType: '' } });
  await sims.updateMany({}, { $unset: { gameType: '' } });

  try {
    await agents.dropIndex('username_1_gameType_1');
  } catch {
    /* ok */
  }
  try {
    await agents.createIndex({ username: 1 }, { unique: true });
  } catch {
    /* ok */
  }

  try {
    await db.collection('verificationrequests').drop();
    console.log('Dropped verificationrequests collection');
  } catch {
    /* ok */
  }

  await games.updateMany({ paymentStatus: 'pending_verify' }, { $set: { paymentStatus: 'unpaid' } });

  console.log('\n=== Unify complete ===');
  console.log(`Agents: ${await agents.countDocuments()}`);
  console.log(`SIMs:   ${await sims.countDocuments()}`);
  console.log(`Games:  35k=${await games.countDocuments({ gameType: '35k' })} 20k=${await games.countDocuments({ gameType: '20k' })}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
