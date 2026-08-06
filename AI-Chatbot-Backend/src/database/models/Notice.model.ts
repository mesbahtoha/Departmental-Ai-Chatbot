import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * Uploaded notices (PDF / TXT / image / pasted text).
 * Reuses the legacy "documents" collection - existing data is preserved.
 */
const noticeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, default: 'general', index: true },
    type: { type: String, default: 'text' },
    mimeType: { type: String, default: 'text/plain' },
    originalFileName: { type: String, default: null },
    fileId: { type: mongoose.Schema.Types.Mixed, default: null },
    rawText: { type: String, default: '' },
    normalizedText: { type: String, default: '' },
    summary: { type: String, default: '' },
    uploadedBy: { type: String, default: 'admin' },
    status: { type: String, default: 'processing' },
    chunkCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'documents' }
);

noticeSchema.index({ createdAt: -1 });
noticeSchema.index({ category: 1, createdAt: -1 });
noticeSchema.index({ title: 1 });
noticeSchema.index({
  title: 'text',
  normalizedText: 'text',
  category: 'text',
  summary: 'text',
});

export type NoticeDocument = InferSchemaType<typeof noticeSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const NoticeModel = mongoose.model('Notice', noticeSchema);
