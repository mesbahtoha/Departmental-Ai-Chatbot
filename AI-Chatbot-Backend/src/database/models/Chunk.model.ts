import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * Keyword chunks derived from notices (retrieval layer).
 * Reuses the legacy "chunks" collection.
 */
const chunkSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Notice',
      required: true,
      index: true,
    },
    title: { type: String, default: '' },
    category: { type: String, default: 'general', index: true },
    chunkIndex: { type: Number, default: 0 },
    chunkText: { type: String, default: '' },
    normalizedChunkText: { type: String, default: '' },
    preview: { type: String, default: '' },
  },
  { timestamps: true, collection: 'chunks' }
);

chunkSchema.index({ title: 'text', chunkText: 'text', normalizedChunkText: 'text' });

export type ChunkDocument = InferSchemaType<typeof chunkSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ChunkModel = mongoose.model('Chunk', chunkSchema);
