import mongoose from 'mongoose';
import { Readable } from 'stream';
import { getDb } from './db';

const { GridFSBucket, ObjectId } = mongoose.mongo;

type GridFSBucketType = InstanceType<typeof GridFSBucket>;
type ObjectIdType = InstanceType<typeof ObjectId>;

/**
 * GridFS helpers for storing uploaded files
 * (notice PDFs/images/text files and user avatars).
 */
export const GRIDFS_BUCKET = 'uploads';

function bucket(): GridFSBucketType {
  const db = getDb();
  if (!db) throw new Error('Database not connected');
  return new GridFSBucket(db, { bucketName: GRIDFS_BUCKET });
}

export function safeObjectId(id: string | ObjectIdType | null | undefined): ObjectIdType | null {
  try {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/** Uploads a buffer into GridFS and returns the file id. */
export function uploadBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  metadata: Record<string, unknown> = {}
): Promise<ObjectIdType> {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket().openUploadStream(filename, {
      contentType: mimeType,
      metadata,
    } as never);

    Readable.from(buffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id));
  });
}

/** Deletes a file from GridFS, ignoring "not found" errors. */
export async function deleteGridFSFile(fileId: string | ObjectIdType | null | undefined): Promise<void> {
  const objectId = safeObjectId(fileId);
  if (!objectId) return;

  try {
    await bucket().delete(objectId);
  } catch {
    // file may already be gone - safe to ignore
  }
}

export interface StoredFileInfo {
  _id: ObjectIdType;
  contentType: string;
  filename: string;
  metadata?: Record<string, unknown>;
}

/** Reads a file's metadata document (uploads.files). */
export async function findFile(fileId: string | ObjectIdType): Promise<StoredFileInfo | null> {
  const objectId = safeObjectId(fileId);
  if (!objectId) return null;

  const db = getDb();
  if (!db) return null;
  const doc = await db.collection(`${GRIDFS_BUCKET}.files`).findOne({ _id: objectId });
  if (!doc) return null;

  return {
    _id: doc._id as ObjectIdType,
    contentType: doc.contentType || 'application/octet-stream',
    filename: doc.filename || 'file',
    metadata: doc.metadata || {},
  };
}

/** Streams a stored file to an Express response. */
export function streamFile(
  res: import('express').Response,
  fileId: string | ObjectIdType
): Promise<void> {
  return new Promise((resolve, reject) => {
    bucket()
      .openDownloadStream(safeObjectId(fileId)!)
      .on('error', reject)
      .on('end', () => resolve())
      .pipe(res);
  });
}

/** Deletes a file and all its chunks. */
export async function deleteFileAndChunks(fileId: string | ObjectIdType): Promise<void> {
  const objectId = safeObjectId(fileId);
  if (!objectId) return;

  const db = getDb();
  if (!db) return;
  await db.collection(`${GRIDFS_BUCKET}.chunks`).deleteMany({ files_id: objectId });
  await deleteGridFSFile(objectId);
}
