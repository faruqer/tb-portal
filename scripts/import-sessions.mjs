/**
 * Import Telebirr session tokens from sessions/<agent>/ into MongoDB SIM cards.
 *
 * Folder layout (same as session-up.py):
 *   sessions/
 *     yonas.json          ← sync metadata (ignored by import)
 *     yonas/
 *       yonas (1).json    ← session index from "(N)" in filename
 *       yonas (2).json
 *     M/
 *       m (1).json
 *     junk/               ← skipped
 *
 * Each session JSON must contain SRBNtoken and SRBNphone.
 * Agent folders are matched to DB agents by username or name (case-insensitive).
 *
 * Usage:
 *   npm run import-sessions
 *   npm run import-sessions -- --folder yonas
 *   npm run import-sessions -- --dry-run
 */
import { readFileSync, readdirSync, statSync } from 'fs';
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

const SKIP_DIRS = new Set(['junk']);

function extractSessionIndex(filename) {
  const match = filename.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
}

function listAgentFolders(basePath) {
  return readdirSync(basePath)
    .filter((name) => {
      if (name.startsWith('.')) return false;
      if (SKIP_DIRS.has(name)) return false;
      return statSync(join(basePath, name)).isDirectory();
    })
    .sort((a, b) => a.localeCompare(b));
}

function readSessionFile(filepath) {
  const data = JSON.parse(readFileSync(filepath, 'utf8'));
  const token = data.SRBNtoken;
  const phone = data.SRBNphone;
  if (!token || !phone) return null;
  return { token: String(token), phone: String(phone) };
}

const AgentSchema = new mongoose.Schema(
  { name: String, username: String },
  { strict: false }
);

const SimCardSchema = new mongoose.Schema(
  {
    agentId: mongoose.Schema.Types.ObjectId,
    sessionId: Number,
    phoneNumber: String,
    sessionToken: String,
  },
  { strict: false }
);

const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
const SimCard = mongoose.models.SimCard || mongoose.model('SimCard', SimCardSchema);

async function findAgent(folderName, agents) {
  const key = folderName.toLowerCase();
  return (
    agents.find((a) => a.username?.toLowerCase() === key) ||
    agents.find((a) => a.name?.toLowerCase() === key) ||
    null
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const folderIdx = args.indexOf('--folder');
  const onlyFolder = folderIdx >= 0 ? args[folderIdx + 1] : null;

  const sessionsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'sessions');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager';

  await mongoose.connect(uri);
  console.log(`Reading sessions from ${sessionsDir}`);
  if (dryRun) console.log('DRY RUN — no database writes\n');

  const agents = await Agent.find().select('_id name username');
  const folders = listAgentFolders(sessionsDir).filter((f) => !onlyFolder || f === onlyFolder);

  if (onlyFolder && folders.length === 0) {
    console.error(`Folder not found: ${onlyFolder}`);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const folder of folders) {
    const agent = await findAgent(folder, agents);
    if (!agent) {
      console.warn(`⚠️  No agent matched folder "${folder}" — skipped`);
      unmatched++;
      continue;
    }

    const dir = join(sessionsDir, folder);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

    console.log(`\n📂 ${folder} → ${agent.name} (@${agent.username})`);

    for (const filename of files) {
      const index = extractSessionIndex(filename);
      if (index === null) continue;

      const session = readSessionFile(join(dir, filename));
      if (!session) {
        console.warn(`  ⚠️  ${filename}: missing SRBNtoken or SRBNphone`);
        skipped++;
        continue;
      }

      const sim = await SimCard.findOne({ agentId: agent._id, sessionId: index });
      if (!sim) {
        console.warn(`  ⚠️  Session ${index}: no SIM card in DB (${session.phone})`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  [dry-run] session ${index}: ${session.phone}`);
        updated++;
        continue;
      }

      await SimCard.updateOne(
        { _id: sim._id },
        { $set: { sessionToken: session.token } }
      );
      console.log(`  ✓ session ${index}: ${session.phone}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} token(s), skipped ${skipped}, unmatched folders ${unmatched}.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
