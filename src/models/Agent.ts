import mongoose, { Schema, type Connection } from 'mongoose';

export const AgentSchema = new Schema(
  {
    legacyId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export type AgentDoc = mongoose.InferSchemaType<typeof AgentSchema> & { _id: mongoose.Types.ObjectId };

export function getAgentModel(conn: Connection) {
  return conn.models.Agent || conn.model('Agent', AgentSchema);
}
