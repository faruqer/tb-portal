import mongoose, { Schema, type Connection } from 'mongoose';

export const SimCardSchema = new Schema(
  {
    legacyId: { type: String, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    phoneNumber: { type: String, required: true, trim: true },
    sessionId: { type: Number, required: true, index: true },
    groupId: { type: String, default: null, trim: true, index: true },
    lastPlayedAtOverride: { type: Date, default: null },
    nextPlayingAtOverride: { type: Date, default: null },
  },
  { timestamps: true }
);

export type SimCardDoc = mongoose.InferSchemaType<typeof SimCardSchema> & { _id: mongoose.Types.ObjectId };

export function getSimCardModel(conn: Connection) {
  return conn.models.SimCard || conn.model('SimCard', SimCardSchema);
}
