/**
 * Copy all collections from one MongoDB database to another (same cluster).
 * Usage: npm run copy-db
 * Defaults: reward-manager → reward-manager-20k
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

function getMongoUri(dbName) {
  const base = process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager';
  if (base.includes('mongodb+srv://') || base.includes('mongodb://')) {
    const [withoutQuery, query = ''] = base.split('?');
    const slash = withoutQuery.lastIndexOf('/');
    if (slash > 'mongodb://'.length) {
      const prefix = withoutQuery.slice(0, slash + 1);
      return query ? `${prefix}${dbName}?${query}` : `${prefix}${dbName}`;
    }
    return query ? `${withoutQuery}/${dbName}?${query}` : `${withoutQuery}/${dbName}`;
  }
  return base;
}

async function copyDatabase(fromDb, toDb) {
  if (fromDb === toDb) {
    throw new Error('Source and target database names must differ');
  }

  console.log(`Connecting to cluster…`);
  await mongoose.connect(getMongoUri(fromDb));

  const client = mongoose.connection.getClient();
  const source = client.db(fromDb);
  const target = client.db(toDb);

  const collections = await source.listCollections().toArray();
  if (collections.length === 0) {
    console.log(`No collections found in "${fromDb}".`);
    await mongoose.disconnect();
    return;
  }

  console.log(`Copying ${collections.length} collection(s): ${fromDb} → ${toDb}\n`);

  let totalDocs = 0;
  for (const { name } of collections) {
    const docs = await source.collection(name).find({}).toArray();
    await target.collection(name).deleteMany({});
    if (docs.length > 0) {
      await target.collection(name).insertMany(docs, { ordered: false });
    }
    totalDocs += docs.length;
    console.log(`  ${name}: ${docs.length} document(s)`);
  }

  console.log(`\nDone — ${totalDocs} document(s) copied to "${toDb}".`);
  await mongoose.disconnect();
}

loadEnv();

const fromDb = process.env.COPY_FROM || process.env.MONGODB_DB_35K || 'reward-manager';
const toDb = process.env.COPY_TO || process.env.MONGODB_DB_20K || 'reward-manager-20k';

copyDatabase(fromDb, toDb).catch((err) => {
  console.error(err);
  process.exit(1);
});
