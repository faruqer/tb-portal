/**
 * Backfill lastPlayed35kAt / lastPlayed20kAt on SIM cards from game history.
 * Usage: npm run backfill-sim-plays
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

function loadEnv() {
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {
    /* .env.local optional */
  }
}

loadEnv();

const SimCardSchema = new mongoose.Schema(
  {
    agentId: mongoose.Schema.Types.ObjectId,
    sessionId: Number,
    lastPlayed35kAt: Date,
    lastPlayed20kAt: Date,
  },
  { strict: false }
);

const GameSchema = new mongoose.Schema(
  {
    agentId: mongoose.Schema.Types.ObjectId,
    sessionId: Number,
    gameType: String,
    date: String,
  },
  { strict: false, timestamps: true }
);

const SimCard = mongoose.models.SimCard || mongoose.model('SimCard', SimCardSchema);
const Game = mongoose.models.Game || mongoose.model('Game', GameSchema);

function playedAt(game) {
  return game.createdAt ? new Date(game.createdAt) : new Date(`${game.date}T00:00:00`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager');
  console.log('Backfilling SIM last-played fields from game history…');

  const games = await Game.find().sort({ createdAt: -1 }).select('agentId sessionId gameType date createdAt');
  const map35 = new Map();
  const map20 = new Map();

  for (const g of games) {
    const key = `${g.agentId.toString()}:${g.sessionId}`;
    if (g.gameType === '35k' && !map35.has(key)) map35.set(key, playedAt(g));
    if (g.gameType === '20k' && !map20.has(key)) map20.set(key, playedAt(g));
  }

  const sims = await SimCard.find().select('_id agentId sessionId');
  let updated = 0;

  for (const sim of sims) {
    const key = `${sim.agentId.toString()}:${sim.sessionId}`;
    const last35 = map35.get(key) ?? null;
    const last20 = map20.get(key) ?? null;
    if (last35 || last20) {
      await SimCard.updateOne(
        { _id: sim._id },
        { $set: { lastPlayed35kAt: last35, lastPlayed20kAt: last20 } }
      );
      updated++;
    }
  }

  console.log(`Updated ${updated} SIM card(s) (${map35.size} with 35K plays, ${map20.size} with 20K plays)`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
