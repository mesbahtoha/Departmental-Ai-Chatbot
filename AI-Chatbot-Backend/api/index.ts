import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app';
import { connectDatabase } from '../src/config/db';

const app = createApp();

let dbPromise: Promise<unknown> | null = null;

function ensureDatabase(): Promise<unknown> {
  if (!dbPromise) dbPromise = connectDatabase();
  return dbPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await ensureDatabase();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed';
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message }));
    return;
  }
  app(req, res);
}
