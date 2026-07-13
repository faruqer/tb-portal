import mongoose, { Schema, type Connection } from 'mongoose';

export const SimCardSchema = new Schema(
  {
    legacyId: { type: String, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    phoneNumber: { type: String, required: true, trim: true },
    sessionId: { type: Number, required: true, index: true },
    groupId: { type: String, default: null, trim: true, index: true },
    lastPlayed35kAt: { type: Date, default: null },
    lastPlayed20kAt: { type: Date, default: null },
    lastPlayedAtOverride: { type: Date, default: null },
    nextPlayingAtOverride: { type: Date, default: null },
  },
  { timestamps: true }
);

SimCardSchema.index({ agentId: 1, sessionId: 1 }, { unique: true });

export type SimCardDoc = mongoose.InferSchemaType<typeof SimCardSchema> & { _id: mongoose.Types.ObjectId };

export function getSimCardModel(conn: Connection) {
  return conn.models.SimCard || conn.model('SimCard', SimCardSchema);
}
