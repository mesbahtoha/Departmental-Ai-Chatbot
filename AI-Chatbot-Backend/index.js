/**
 * Root entry point - mirrors api/index.ts.
 *
 * The original project deployed a root-level index.js (the legacy
 * monolith). Deleting it left Vercel's zero-config "/" route pointing at
 * a missing function, so "GET /" hung until the 300s runtime timeout
 * while every other path kept working. This file restores that root
 * route, forwarding to the same modular handler as the api/ function.
 */
require('dotenv').config();

const { createApp } = require('./dist/app');
const { connectDatabase, runBootJobs } = require('./dist/config/db');

const app = createApp();

let dbPromise = null;

function ensureDatabase() {
  if (!dbPromise) dbPromise = connectDatabase();
  return dbPromise;
}

module.exports = async function handler(req, res) {
  try {
    await ensureDatabase();
    // Indexes + seeding run detached so cold starts never block requests.
    runBootJobs();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed';
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message }));
    return;
  }
  app(req, res);
};
