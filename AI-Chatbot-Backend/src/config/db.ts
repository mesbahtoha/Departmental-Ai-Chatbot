import mongoose from 'mongoose';
import env from './env';
import { log } from './logger';
import { ensureIndexes } from '../database/indexes';
import { seedDatabase } from '../database/seeders';

let isConnected = false;

/**
 * Establishes the MongoDB connection using Mongoose.
 * Reuses an existing connection when possible (serverless-safe).
 */
export async function connectDatabase(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    log.info('MongoDB connected');
  });

  mongoose.connection.on('error', (error) => {
    log.error('MongoDB connection error', { message: error.message });
  });

  mongoose.connection.on('disconnected', () => {
    log.warn('MongoDB disconnected');
    isConnected = false;
  });

  if (!env.mongoUri) {
    throw new Error('MONGO_URI is missing in .env');
  }

  await mongoose.connect(env.mongoUri, {
    dbName: env.dbName,
    serverSelectionTimeoutMS: 15000,
  });

  isConnected = true;

  await ensureIndexes();
  await seedDatabase();

  await mongoose.connection.db?.command({ ping: 1 });

  return mongoose;
}

/** Returns the underlying native MongoDB Db (used for GridFS + raw queries). */
export function getDb() {
  return mongoose.connection.db;
}

/** Disconnects cleanly (used in tests / graceful shutdown). */
export async function disconnectDatabase(): Promise<void> {
  isConnected = false;
  await mongoose.disconnect();
}

export default connectDatabase;
