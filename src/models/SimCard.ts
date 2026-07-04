import mongoose, { Schema, models, model } from 'mongoose';

const SimCardSchema = new Schema(
  {
    legacyId: { type: String, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    phoneNumber: { type: String, required: true, trim: true },
    sessionId: { type: Number, required: true, index: true },
    groupId: { type: String, default: null, trim: true, index: true },
  },
  { timestamps: true }
);

export type SimCardDoc = mongoose.InferSchemaType<typeof SimCardSchema> & { _id: mongoose.Types.ObjectId };

export const SimCard = models.SimCard || model('SimCard', SimCardSchema);
