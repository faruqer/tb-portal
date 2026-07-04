/** Reset all agent passwords to agent123 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reward-manager';
const PASSWORD = 'agent123';

const AgentSchema = new mongoose.Schema({ name: String, username: String, passwordHash: String });
const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  const hash = await bcrypt.hash(PASSWORD, 10);
  const result = await Agent.updateMany({}, { $set: { passwordHash: hash } });
  const agents = await Agent.find().select('name username');
  console.log(`Reset ${result.modifiedCount} agent password(s) to: ${PASSWORD}`);
  agents.forEach((a) => console.log(`  - ${a.name} (@${a.username})`));
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
