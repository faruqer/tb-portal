import mongoose, { Schema, models, model } from 'mongoose';

const VerificationRequestSchema = new Schema(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    amount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type VerificationRequestDoc = mongoose.InferSchemaType<typeof VerificationRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const VerificationRequest = models.VerificationRequest || model('VerificationRequest', VerificationRequestSchema);
