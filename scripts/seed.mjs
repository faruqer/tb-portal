/**
 * Seed the database with rich demo data for UI testing.
 * Usage: npm run seed
 * Clears all data and inserts fresh sample records.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const AGENT_PASSWORD = 'agent123';

const GAME_TYPES = [
  { key: '35k', label: '35K Win' },
  { key: '20k', label: '20K Win' },
];

const AgentSchema = new mongoose.Schema(
  { gameType: String, name: String, username: String, passwordHash: String },
  { timestamps: true }
);
const GameSchema = new mongoose.Schema(
  {
    gameType: String,
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
  },
  { timestamps: true }
);
const SimCardSchema = new mongoose.Schema(
  {
    gameType: String,
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    phoneNumber: String,
    sessionId: Number,
    groupId: { type: String, default: null },
  },
  { timestamps: true }
);
const VerificationRequestSchema = new mongoose.Schema(
  {
    gameType: String,
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    status: String,
    amount: Number,
  },
  { timestamps: true }
);

const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
const Game = mongoose.models.Game || mongoose.model('Game', GameSchema);
const SimCard = mongoose.models.SimCard || mongoose.model('SimCard', SimCardSchema);
const VerificationRequest =
  mongoose.models.VerificationRequest || mongoose.model('VerificationRequest', VerificationRequestSchema);

function calcNet(won) {
  return Number((won * 0.75).toFixed(2));
}
function calcExpected(net) {
  return Number((net * 0.5).toFixed(2));
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysAgoDate(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const AGENTS = [
  { name: 'M', username: 'm' },
  { name: 'Abdi', username: 'abdi' },
  { name: 'Aman', username: 'aman' },
  { name: 'Judin', username: 'judin' },
  { name: 'Anwar', username: 'anwar' },
  { name: 'Hena', username: 'hena' },
  { name: 'Mark', username: 'mark' },
  { name: 'Yonas', username: 'yonas' },
];

/** SIM layout: [sessionId, phone, groupId|null] */
const SIM_LAYOUT = {
  m: [
    [1, '0911000101', null],
    [2, '0911000102', 'A'],
    [2, '0911000103', 'A'],
    [3, '0911000104', null],
    [4, '954914700', null],
    [5, '0911000105', null],
    [6, '0911000106', null],
    [10, '0911000110', null],
    [12, '0911000112', 'B'],
    [12, '0911000113', 'B'],
  ],
  abdi: [
    [1, '0922000201', null],
    [2, '0922000202', null],
    [3, '0922000203', null],
    [4, '0922000204', null],
    [7, '0922000207', 'C'],
    [7, '0922000208', 'C'],
    [8, '0922000208', 'D'],
    [15, '0922000215', null],
  ],
  aman: [
    [1, '0933000301', null],
    [2, '0904020242', null],
    [3, '0933000303', null],
    [5, '0933000305', null],
    [9, '0933000309', null],
    [11, '0933000311', null],
  ],
  judin: [
    [1, '0944000401', null],
    [2, '0944000402', null],
    [4, '0941644407', 'E'],
    [4, '0944000404', 'E'],
    [6, '0944000406', null],
    [20, '0944000420', null],
  ],
  anwar: [
    [1, '0955000501', null],
    [3, '0955000503', null],
    [6, '0955000506', 'F'],
    [6, '0955000507', 'F'],
    [8, '0955000508', null],
    [90, '0955000590', null],
  ],
  hena: [
    [1, '0966000601', null],
    [2, '0966000602', null],
    [5, '0966000605', null],
    [7, '0966000607', null],
  ],
  mark: [
    [1, '0977000701', null],
    [2, '0977000702', null],
    [3, '0977000703', null],
    [4, '0977000704', null],
    [10, '0977000710', 'G'],
    [10, '0977000711', 'G'],
  ],
  yonas: [
    [1, '0988000801', null],
    [2, '0988000802', null],
    [3, '0988000803', null],
    [4, '0988000804', null],
    [5, '0988000805', null],
  ],
};

/** Games: [sessionId, wonProfit, daysAgo, compite, idStatus, completed, paymentStatus, receivedOverride?] */
function buildGamesForAgent(agentKey) {
  const templates = {
    m: [
      [2, 201, 0, 'completed', 'pending', 'pending', 'unpaid'],
      [6, 201, 0, 'completed', 'sent', 'pending', 'pending_verify'],
      [3, 185, 1, 'completed', 'pending', 'pending', 'paid'],
      [12, 201, 1, 'completed', 'pending', 'pending', 'unpaid'],
      [1, 150, 2, 'completed', 'sent', 'completed', 'paid'],
      [2, 201, 3, 'completed', 'pending', 'completed', 'paid'],
      [4, 220, 4, 'pending', 'pending', 'pending', 'unpaid'],
      [5, 201, 5, 'completed', 'sent', 'completed', 'paid'],
      [10, 175, 6, 'completed', 'pending', 'completed', 'unpaid'],
      [3, 201, 8, 'completed', 'sent', 'completed', 'paid'],
      [6, 190, 10, 'completed', 'pending', 'completed', 'paid'],
      [12, 201, 12, 'completed', 'sent', 'completed', 'paid'],
      [1, 201, 15, 'completed', 'pending', 'completed', 'paid'],
      [2, 160, 18, 'completed', 'sent', 'completed', 'paid'],
    ],
    abdi: [
      [1, 201, 0, 'completed', 'pending', 'pending', 'pending_verify'],
      [3, 201, 1, 'completed', 'sent', 'pending', 'unpaid'],
      [7, 201, 2, 'completed', 'pending', 'pending', 'unpaid'],
      [1, 180, 4, 'completed', 'sent', 'completed', 'paid'],
      [3, 201, 7, 'completed', 'pending', 'completed', 'paid'],
      [7, 195, 9, 'completed', 'sent', 'completed', 'paid'],
      [8, 201, 11, 'completed', 'pending', 'completed', 'unpaid'],
      [2, 201, 14, 'completed', 'sent', 'completed', 'paid'],
    ],
    aman: [
      [2, 201, 0, 'completed', 'pending', 'pending', 'unpaid'],
      [3, 201, 0, 'completed', 'sent', 'pending', 'pending_verify'],
      [9, 201, 2, 'completed', 'pending', 'pending', 'unpaid'],
      [2, 201, 5, 'completed', 'sent', 'completed', 'paid'],
      [3, 175, 8, 'completed', 'pending', 'completed', 'paid'],
      [1, 201, 12, 'completed', 'sent', 'completed', 'paid'],
      [5, 190, 16, 'completed', 'pending', 'completed', 'paid'],
      [11, 201, 20, 'completed', 'sent', 'completed', 'unpaid'],
    ],
    judin: [
      [1, 201, 0, 'completed', 'pending', 'pending', 'unpaid'],
      [2, 201, 1, 'completed', 'sent', 'pending', 'pending_verify'],
      [6, 201, 2, 'completed', 'pending', 'pending', 'unpaid'],
      [4, 201, 4, 'pending', 'pending', 'pending', 'unpaid'],
      [1, 201, 6, 'completed', 'sent', 'completed', 'paid'],
      [2, 160, 9, 'completed', 'pending', 'completed', 'paid'],
      [6, 201, 13, 'completed', 'sent', 'completed', 'paid'],
      [20, 185, 17, 'completed', 'pending', 'completed', 'paid'],
    ],
    anwar: [
      [1, 201, 0, 'completed', 'pending', 'pending', 'unpaid'],
      [6, 201, 0, 'completed', 'sent', 'pending', 'pending_verify'],
      [90, 201, 1, 'completed', 'pending', 'pending', 'unpaid'],
      [6, 201, 3, 'completed', 'sent', 'completed', 'paid'],
      [1, 175, 6, 'completed', 'pending', 'completed', 'paid'],
      [90, 201, 10, 'completed', 'sent', 'completed', 'paid'],
      [8, 201, 14, 'completed', 'pending', 'completed', 'unpaid'],
      [3, 190, 19, 'completed', 'sent', 'completed', 'paid'],
    ],
    hena: [
      [2, 201, 0, 'completed', 'pending', 'pending', 'unpaid'],
      [7, 201, 2, 'completed', 'sent', 'pending', 'pending_verify'],
      [2, 201, 5, 'completed', 'pending', 'completed', 'paid'],
      [7, 180, 9, 'completed', 'sent', 'completed', 'paid'],
      [1, 201, 14, 'completed', 'pending', 'completed', 'paid'],
      [5, 201, 21, 'completed', 'sent', 'completed', 'paid'],
    ],
    mark: [
      [1, 201, 0, 'completed', 'pending', 'pending', 'unpaid'],
      [10, 201, 0, 'completed', 'sent', 'pending', 'pending_verify'],
      [3, 201, 1, 'completed', 'pending', 'pending', 'unpaid'],
      [1, 201, 4, 'completed', 'sent', 'completed', 'paid'],
      [10, 195, 7, 'completed', 'pending', 'completed', 'paid'],
      [3, 201, 11, 'completed', 'sent', 'completed', 'paid'],
      [4, 170, 16, 'completed', 'pending', 'completed', 'paid'],
      [2, 201, 22, 'completed', 'sent', 'completed', 'unpaid'],
    ],
    yonas: [
      [2, 201, 1, 'completed', 'pending', 'pending', 'unpaid'],
      [4, 201, 3, 'completed', 'sent', 'pending', 'pending_verify'],
      [2, 201, 6, 'completed', 'pending', 'completed', 'paid'],
      [4, 185, 10, 'completed', 'sent', 'completed', 'paid'],
      [1, 201, 15, 'completed', 'pending', 'completed', 'paid'],
      [3, 201, 20, 'completed', 'sent', 'completed', 'paid'],
    ],
  };
  return templates[agentKey] || [];
}

async function seedGameType({ key, label }) {
  console.log(`\n=== Seeding ${label} (${key}) ===`);

  console.log(`Clearing existing ${key} data…`);
  await Promise.all([
    Agent.deleteMany({ gameType: key }),
    Game.deleteMany({ gameType: key }),
    SimCard.deleteMany({ gameType: key }),
    VerificationRequest.deleteMany({ gameType: key }),
  ]);

  const passwordHash = await bcrypt.hash(AGENT_PASSWORD, 10);
  const agentDocs = {};

  console.log('Creating agents...');
  for (const a of AGENTS) {
    const doc = await Agent.create({ name: a.name, username: a.username, passwordHash, gameType: key });
    agentDocs[a.username] = doc;
  }

  console.log('Creating SIM cards...');
  let simCount = 0;
  for (const a of AGENTS) {
    const sims = SIM_LAYOUT[a.username] || [];
    for (const [sessionId, phone, groupId] of sims) {
      await SimCard.create({
        agentId: agentDocs[a.username]._id,
        phoneNumber: phone,
        sessionId,
        groupId: groupId || null,
        gameType: key,
      });
      simCount++;
    }
  }

  console.log('Creating games...');
  let gameCount = 0;
  const pendingVerifyGames = [];

  for (const a of AGENTS) {
    const games = buildGamesForAgent(a.username);
    for (const [sessionId, won, days, compite, idStatus, completed, paymentStatus] of games) {
      const net = calcNet(won);
      const expected = calcExpected(net);
      const received = paymentStatus === 'paid' ? expected : 0;

      const game = await Game.create({
        gameName: String(sessionId),
        sessionId,
        agentId: agentDocs[a.username]._id,
        wonProfit: won,
        netProfit: net,
        expectedToReceive: expected,
        received,
        date: daysAgo(days),
        compite,
        idStatus,
        completed,
        paymentStatus,
        gameType: key,
        createdAt: daysAgoDate(days),
      });
      gameCount++;

      if (paymentStatus === 'pending_verify') {
        pendingVerifyGames.push({ game, agentId: agentDocs[a.username]._id });
      }
    }
  }

  console.log('Creating verification requests...');
  let verifyCount = 0;
  for (const { game, agentId } of pendingVerifyGames) {
    const submitted = game.expectedToReceive + (Math.random() > 0.5 ? 0 : -5);
    await VerificationRequest.create({
      gameId: game._id,
      agentId,
      status: 'pending',
      amount: Number(submitted.toFixed(2)),
      gameType: key,
      createdAt: new Date(),
    });
    verifyCount++;
  }

  const paidGames = await Game.find({ paymentStatus: 'paid', gameType: key }).limit(6);
  for (let i = 0; i < paidGames.length; i++) {
    await VerificationRequest.create({
      gameId: paidGames[i]._id,
      agentId: paidGames[i].agentId,
      status: 'approved',
      amount: paidGames[i].expectedToReceive,
      gameType: key,
      createdAt: daysAgoDate(i + 3),
    });
    verifyCount++;
  }

  const unpaidGames = await Game.find({ paymentStatus: 'unpaid', gameType: key }).limit(2);
  for (const g of unpaidGames) {
    await VerificationRequest.create({
      gameId: g._id,
      agentId: g.agentId,
      status: 'rejected',
      amount: g.expectedToReceive,
      gameType: key,
      createdAt: daysAgoDate(5),
    });
    verifyCount++;
  }

  const todayGames = await Game.countDocuments({ date: daysAgo(0), gameType: key });
  const activeGames = await Game.countDocuments({ completed: 'pending', gameType: key });

  console.log(`--- ${label} seed complete ---`);
  console.log(`Agents:     ${AGENTS.length} (password: ${AGENT_PASSWORD})`);
  console.log(`SIM cards:  ${simCount}`);
  console.log(`Games:      ${gameCount} (${todayGames} today, ${activeGames} active)`);
  console.log(`Verify:     ${verifyCount} (${pendingVerifyGames.length} pending)`);
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager');

  for (const game of GAME_TYPES) {
    await seedGameType(game);
  }

  console.log('\nLogin as admin: admin / admin1001');
  console.log('Login as agent: m / agent123 (or any agent username)');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
