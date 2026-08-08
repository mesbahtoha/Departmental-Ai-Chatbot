import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app';
import { connectDatabase, runBootJobs } from '../src/config/db';
import { log, logger } from '../src/config/logger';
import { MongoLogTransport } from '../src/config/logger-mongo';

const app = createApp();

// Persist logs to MongoDB so the admin "Logs" panel works on Vercel too
// (the transport was defined but never registered anywhere).
let mongoLogsRegistered = false;
function registerMongoLogs(): void {
  if (mongoLogsRegistered) return;
  mongoLogsRegistered = true;
  logger.add(new MongoLogTransport({ source: 'app', level: 'info' }));
}

let dbPromise: Promise<unknown> | null = null;

function ensureDatabase(): Promise<unknown> {
  if (!dbPromise) dbPromise = connectDatabase();
  return dbPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const isRoot = (req.url || '').replace(/\?.*$/, '') === '/';
  if (isRoot) log.info('TRACE root: handler start');
  try {
    await ensureDatabase();
    registerMongoLogs();
    if (isRoot) log.info('TRACE root: db connected');
    // Indexes + seeding run detached so cold starts never block requests.
    runBootJobs();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed';
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message }));
    return;
  }
  if (isRoot) log.info('TRACE root: dispatching to express');
  app(req, res);
}
