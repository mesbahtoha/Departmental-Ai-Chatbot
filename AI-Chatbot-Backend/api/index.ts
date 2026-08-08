import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app';
import { connectDatabase, runBootJobs } from '../src/config/db';
import { log } from '../src/config/logger';

const app = createApp();

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
