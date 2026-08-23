/**
 * Remove session sync fields from MongoDB (one-time cleanup).
 * Usage: npm run strip-session-sync
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
    /* optional */
  }
}

loadEnv();

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager';
  await mongoose.connect(uri);

  const agents = await mongoose.connection.db.collection('agents').updateMany(
    {},
    { $unset: { lastSessionSyncAt: '' } }
  );
  const sims = await mongoose.connection.db.collection('simcards').updateMany(
    {},
    { $unset: { sessionToken: '' } }
  );

  console.log(`Removed lastSessionSyncAt from ${agents.modifiedCount} agent(s)`);
  console.log(`Removed sessionToken from ${sims.modifiedCount} SIM card(s)`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
