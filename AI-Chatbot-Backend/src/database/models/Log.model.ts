import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * System / application log entries (admin Logs panel).
 */
const logSchema = new Schema(
  {
    level: { type: String, enum: ['error', 'warn', 'info', 'debug', 'http'], required: true },
    message: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    source: { type: String, default: 'app' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'logs' }
);

logSchema.index({ level: 1, timestamp: -1 });

export type LogDocument = InferSchemaType<typeof logSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const LogModel = mongoose.model('Log', logSchema);
