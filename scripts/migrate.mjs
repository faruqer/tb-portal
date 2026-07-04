/**
 * Standalone migration script — imports JSON data from the old system into MongoDB.
 * Usage: npm run migrate
 * Add --force to re-import: npm run migrate -- --force
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const force = process.argv.includes('--force');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager';

const AgentSchema = new mongoose.Schema({
  legacyId: String,
  name: String,
  username: String,
  passwordHash: String,
}, { timestamps: true });

const GameSchema = new mongoose.Schema({
  legacyId: String,
  gameName: String,
  sessionId: Number,
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  wonProfit: Number,
  netProfit: Number,
  expectedToReceive: Number,
  received: Number,
  date: String,
  compite: String,
  idStatus: String,
  completed: String,
  paymentStatus: String,
}, { timestamps: true });

const SimCardSchema = new mongoose.Schema({
  legacyId: String,
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  phoneNumber: String,
  sessionId: Number,
  inUse: Boolean,
  inUseSetAt: Date,
  markedSameId: Boolean,
}, { timestamps: true });

const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
const Game = mongoose.models.Game || mongoose.model('Game', GameSchema);
const SimCard = mongoose.models.SimCard || mongoose.model('SimCard', SimCardSchema);

function calcNet(won) { return Number((won * 0.75).toFixed(2)); }
function calcExpected(net) { return Number((net * 0.5).toFixed(2)); }
function parseSessionId(v) { const n = Number(v); return Number.isFinite(n) ? Math.floor(n) : 0; }

async function main() {
  await mongoose.connect(MONGODB_URI);

  const count = await Agent.countDocuments();
  if (count > 0 && !force) {
    console.log('Database already has data. Use --force to re-import.');
    process.exit(1);
  }

  if (force) {
    await Promise.all([Agent.deleteMany({}), Game.deleteMany({}), SimCard.deleteMany({})]);
  }

  const [agentsRaw, gamesRaw, completedRaw, simsRaw] = await Promise.all([
    readFile(path.join(dataDir, 'agents.json'), 'utf-8'),
    readFile(path.join(dataDir, 'games.json'), 'utf-8'),
    readFile(path.join(dataDir, 'completed-games.json'), 'utf-8'),
    readFile(path.join(dataDir, 'phone-numbers.json'), 'utf-8'),
  ]);

  const agentsJson = JSON.parse(agentsRaw);
  const gamesJson = [...JSON.parse(gamesRaw), ...JSON.parse(completedRaw)];
  const simsJson = JSON.parse(simsRaw);
  const agentMap = new Map();
  const hash = await bcrypt.hash('changeme123', 10);

  for (const a of agentsJson) {
    const username = a.name.toLowerCase().replace(/[^a-z0-9]/g, '') || `agent${a.id.slice(0, 6)}`;
    const agent = await Agent.create({ legacyId: a.id, name: a.name, username, passwordHash: hash });
    agentMap.set(a.id, agent._id);
  }

  for (const g of gamesJson) {
    const agentId = agentMap.get(g.agentId);
    if (!agentId) continue;
    const won = Number(g.wonProfit) || 0;
    const net = calcNet(won);
    await Game.create({
      legacyId: g.id,
      gameName: String(g.gameName || ''),
      sessionId: parseSessionId(g.gameName),
      agentId,
      wonProfit: won,
      netProfit: net,
      expectedToReceive: g.expectedToReceive !== undefined ? Number(g.expectedToReceive) : calcExpected(net),
      received: Number(g.received) || 0,
      date: String(g.date || new Date().toISOString().slice(0, 10)),
      compite: g.compite === 'completed' ? 'completed' : 'pending',
      idStatus: g.idStatus === 'sent' ? 'sent' : 'pending',
      completed: g.completed === 'completed' ? 'completed' : 'pending',
      paymentStatus: Number(g.received) > 0 ? 'paid' : 'unpaid',
    });
  }

  for (const s of simsJson) {
    const agentId = agentMap.get(s.agentId);
    if (!agentId) continue;
    await SimCard.create({
      legacyId: s.id,
      agentId,
      phoneNumber: String(s.phoneNumber || ''),
      sessionId: parseSessionId(s.profileName),
      inUse: Boolean(s.inUse),
      inUseSetAt: s.inUseSetAt ? new Date(s.inUseSetAt) : null,
      markedSameId: false,
    });
  }

  console.log(`Imported ${agentsJson.length} agents, ${gamesJson.length} games, ${simsJson.length} sims`);
  console.log('Default agent password: changeme123');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
