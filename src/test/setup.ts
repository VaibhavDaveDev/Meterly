import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';
import { vi } from 'vitest';
import path from 'path';
import '@testing-library/jest-dom';

// Create an in-memory database
const sqlite = new Database(':memory:');

// Cloudflare D1 does NOT enforce FK constraints (PRAGMA foreign_keys = OFF is the default).
// Disable FK enforcement here to match production behavior. Our application code manually
// manages cascade order, so FK enforcement at the DB engine level is not needed in tests.
sqlite.pragma('foreign_keys = OFF');

// Wrap it with Drizzle using the better-sqlite3 driver
export const testDb = drizzle(sqlite, { schema });

// Run migrations against the in-memory database
migrate(testDb, { migrationsFolder: path.resolve(__dirname, '../db/migrations') });

// Mock the getDb function from src/db/index so that API routes use the in-memory DB
vi.mock('../db/index', () => ({
  getDb: () => testDb,
}));
