/**
 * Merge separate 35K / 20K databases into one shared database.
 * - Tags existing reward-manager data as gameType: '35k'
 * - Imports reward-manager-20k data as gameType: '20k'
 * Usage: npm run merge-db
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

function dbNameFromUri(uri) {
  const [withoutQuery] = uri.split('?');
  const slash = withoutQuery.lastIndexOf('/');
  return slash > 'mongodb://'.length ? withoutQuery.slice(slash + 1) : 'reward-manager';
}

function uriForDb(baseUri, dbName) {
  const [withoutQuery, query = ''] = baseUri.split('?');
  const slash = withoutQuery.lastIndexOf('/');
  const prefix = slash > 'mongodb://'.length ? withoutQuery.slice(0, slash + 1) : `${withoutQuery}/`;
  return query ? `${prefix}${dbName}?${query}` : `${prefix}${dbName}`;
}

const COLLECTIONS = ['agents', 'games', 'simcards', 'verificationrequests'];

async function tagExisting(mainDb) {
  let tagged = 0;
  for (const name of COLLECTIONS) {
    const col = mainDb.collection(name);
    const res = await col.updateMany({ gameType: { $exists: false } }, { $set: { gameType: '35k' } });
    tagged += res.modifiedCount;
    console.log(`  ${name}: tagged ${res.modifiedCount} document(s) as 35k`);
  }
  return tagged;
}

async function dropLegacyUsernameIndex(mainDb) {
  try {
    await mainDb.collection('agents').dropIndex('username_1');
    console.log('  Dropped legacy username_1 index');
  } catch {
    /* already removed */
  }
  try {
    await mainDb.collection('agents').createIndex({ username: 1, gameType: 1 }, { unique: true });
    console.log('  Ensured username + gameType unique index');
  } catch (err) {
    console.warn('  Index note:', err.message);
  }
}

async function import20k(mainDb, sourceDb) {
  const agentMap = new Map();
  const gameMap = new Map();

  const sourceAgents = await sourceDb.collection('agents').find({}).toArray();
  const existing20kAgents = await mainDb.collection('agents').find({ gameType: '20k' }).toArray();
  const byUsername = new Map(existing20kAgents.map((a) => [a.username, a._id]));

  console.log(`\nImporting ${sourceAgents.length} agent(s) as 20k…`);
  for (const doc of sourceAgents) {
    const oldId = doc._id.toString();
    if (byUsername.has(doc.username)) {
      agentMap.set(oldId, byUsername.get(doc.username));
      continue;
    }
    const { _id, gameType, ...rest } = doc;
    const newId = new mongoose.Types.ObjectId();
    await mainDb.collection('agents').insertOne({ ...rest, _id: newId, gameType: '20k' });
    agentMap.set(oldId, newId);
    byUsername.set(doc.username, newId);
  }

  const sourceGames = await sourceDb.collection('games').find({}).toArray();
  console.log(`Importing ${sourceGames.length} game(s) as 20k…`);
  for (const doc of sourceGames) {
    const oldId = doc._id.toString();
    const agentId = agentMap.get(doc.agentId?.toString());
    if (!agentId) continue;
    const { _id, gameType, agentId: _a, ...rest } = doc;
    const newId = new mongoose.Types.ObjectId();
    await mainDb.collection('games').insertOne({ ...rest, _id: newId, agentId, gameType: '20k' });
    gameMap.set(oldId, newId);
  }

  const sourceSims = await sourceDb.collection('simcards').find({}).toArray();
  console.log(`Importing ${sourceSims.length} SIM(s) as 20k…`);
  for (const doc of sourceSims) {
    const agentId = agentMap.get(doc.agentId?.toString());
    if (!agentId) continue;
    const { _id, gameType, agentId: _a, ...rest } = doc;
    await mainDb.collection('simcards').insertOne({ ...rest, agentId, gameType: '20k' });
  }

  const sourceVerify = await sourceDb.collection('verificationrequests').find({}).toArray();
  console.log(`Importing ${sourceVerify.length} verification request(s) as 20k…`);
  for (const doc of sourceVerify) {
    const agentId = agentMap.get(doc.agentId?.toString());
    const gameId = gameMap.get(doc.gameId?.toString());
    if (!agentId || !gameId) continue;
    const { _id, gameType, agentId: _a, gameId: _g, ...rest } = doc;
    await mainDb.collection('verificationrequests').insertOne({
      ...rest,
      agentId,
      gameId,
      gameType: '20k',
    });
  }

  return {
    agents: agentMap.size,
    games: gameMap.size,
    sims: sourceSims.length,
    verify: sourceVerify.length,
  };
}

async function main() {
  loadEnv();
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager';
  const mainName = dbNameFromUri(baseUri);
  const source20k = process.env.MONGODB_DB_20K || 'reward-manager-20k';

  console.log(`Connecting to ${mainName}…`);
  await mongoose.connect(uriForDb(baseUri, mainName));
  const client = mongoose.connection.getClient();
  const mainDb = client.db(mainName);
  const sourceDb = client.db(source20k);

  console.log('\nStep 1: Tag existing data as 35k');
  await tagExisting(mainDb);
  await dropLegacyUsernameIndex(mainDb);

  const count20k = await mainDb.collection('agents').countDocuments({ gameType: '20k' });
  if (count20k > 0) {
    console.log(`\n20k data already present (${count20k} agents). Skipping import.`);
    console.log('Delete 20k documents first or run with FORCE=1 to re-import.');
    if (process.env.FORCE !== '1') {
      await mongoose.disconnect();
      return;
    }
    console.log('FORCE=1 — clearing existing 20k data…');
    for (const name of COLLECTIONS) {
      await mainDb.collection(name).deleteMany({ gameType: '20k' });
    }
  }

  const sourceAgentCount = await sourceDb.collection('agents').countDocuments();
  if (sourceAgentCount === 0) {
    console.log(`\nNo data in ${source20k} to import.`);
  } else {
    console.log(`\nStep 2: Import from ${source20k}`);
    const stats = await import20k(mainDb, sourceDb);
    console.log('\nImport summary:', stats);
  }

  const totals = {};
  for (const name of COLLECTIONS) {
    totals[name] = {
      '35k': await mainDb.collection(name).countDocuments({ gameType: '35k' }),
      '20k': await mainDb.collection(name).countDocuments({ gameType: '20k' }),
    };
  }

  console.log('\n=== Merge complete ===');
  console.log(JSON.stringify(totals, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
