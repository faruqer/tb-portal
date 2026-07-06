import mongoose, { Schema, type Connection } from 'mongoose';

export const GameSchema = new Schema(
  {
    legacyId: { type: String, index: true },
    gameType: { type: String, enum: ['35k', '20k'], required: true, default: '35k', index: true },
    gameName: { type: String, required: true, trim: true },
    sessionId: { type: Number, required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    wonProfit: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    expectedToReceive: { type: Number, default: 0 },
    received: { type: Number, default: 0 },
    date: { type: String, required: true },
    compite: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    idStatus: { type: String, enum: ['pending', 'sent'], default: 'pending' },
    completed: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending_verify', 'paid'],
      default: 'unpaid',
    },
  },
  { timestamps: true }
);

export type GameDoc = mongoose.InferSchemaType<typeof GameSchema> & { _id: mongoose.Types.ObjectId };

export function getGameModel(conn: Connection) {
  return conn.models.Game || conn.model('Game', GameSchema);
}
