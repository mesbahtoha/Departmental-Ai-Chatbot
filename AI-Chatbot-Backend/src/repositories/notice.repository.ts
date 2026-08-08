import { FilterQuery } from 'mongoose';
import { NoticeModel, NoticeDocument } from '../database/models/Notice.model';
import { ChunkModel, ChunkDocument } from '../database/models/Chunk.model';

/**
 * Notice + chunk repositories - typed access to uploaded documents.
 */
export const noticeRepository = {
  async findById(id: unknown): Promise<NoticeDocument | null> {
    try {
      return await NoticeModel.findById(String(id));
    } catch {
      return null;
    }
  },

  /** Lightweight lookup by ids (file metadata for citations/sources). */
  async findByIds(ids: unknown[]): Promise<Array<Record<string, unknown>>> {
    if (!ids.length) return [];
    return NoticeModel.find({ _id: { $in: ids } })
      .select('_id fileId mimeType')
      .lean() as unknown as Array<Record<string, unknown>>;
  },

  /** Full lookup by ids (used by search to hydrate chunk matches in bulk). */
  async findByIdsFull(ids: unknown[]): Promise<Array<Record<string, unknown>>> {
    if (!ids.length) return [];
    return NoticeModel.find({ _id: { $in: ids } })
      .select('_id title category type fileId mimeType rawText summary createdAt')
      .lean() as unknown as Array<Record<string, unknown>>;
  },

  async findByIdLean(id: unknown) {
    try {
      return await NoticeModel.findById(String(id)).lean();
    } catch {
      return null;
    }
  },

  async create(data: Partial<NoticeDocument>): Promise<NoticeDocument> {
    return NoticeModel.create(data);
  },

  async update(id: unknown, data: Record<string, unknown>): Promise<NoticeDocument | null> {
    try {
      return await NoticeModel.findByIdAndUpdate(String(id), { $set: data }, { new: true });
    } catch {
      return null;
    }
  },

  async delete(id: unknown): Promise<void> {
    try {
      await NoticeModel.deleteOne({ _id: String(id) });
    } catch {
      // ignore
    }
  },

  async list(filter: FilterQuery<NoticeDocument> = {}, limit = 100): Promise<NoticeDocument[]> {
    return NoticeModel.find(filter).sort({ createdAt: -1 }).limit(limit);
  },

  async count(filter: FilterQuery<NoticeDocument> = {}): Promise<number> {
    return NoticeModel.countDocuments(filter);
  },

  /** Raw driver search with text score (kept for legacy parity). */
  async rawFind(query: unknown, projection: Record<string, unknown>, limit: number) {
    const filter = query as Record<string, unknown>;
    return NoticeModel.collection
      .find(filter, { projection })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .toArray();
  },

  /** Raw driver regex search (kept for legacy parity). */
  async rawRegexFind(query: unknown, projection: Record<string, unknown>, limit: number) {
    const filter = query as Record<string, unknown>;
    return NoticeModel.collection.find(filter, { projection }).limit(limit).toArray();
  },
};

export const chunkRepository = {
  async deleteByDocument(documentId: unknown): Promise<void> {
    await ChunkModel.deleteMany({ documentId: String(documentId) });
  },

  async insertMany(chunks: Array<Record<string, unknown>>): Promise<number> {
    if (!chunks.length) return 0;
    const result = await ChunkModel.insertMany(chunks as never[]);
    return result.length;
  },

  async findByDocumentIds(documentIds: unknown[]): Promise<ChunkDocument[]> {
    return ChunkModel.find({ documentId: { $in: documentIds } }).lean() as unknown as Promise<ChunkDocument[]>;
  },

  async rawRegexFind(query: unknown, projection: Record<string, unknown>, limit: number) {
    const filter = query as Record<string, unknown>;
    return ChunkModel.collection.find(filter, { projection }).limit(limit).toArray();
  },
};
