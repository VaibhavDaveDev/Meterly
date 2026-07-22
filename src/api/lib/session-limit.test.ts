/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { enforceSessionLimit } from './session-limit';

describe('enforceSessionLimit', () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    
    // Create tables (simplified for test)
    sqlite.exec(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY, 
        name TEXT NOT NULL, 
        email TEXT NOT NULL, 
        email_verified INTEGER NOT NULL, 
        image TEXT,
        theme TEXT,
        primary_role TEXT,
        onboarding_completed_at INTEGER,
        onboarding_checklist TEXT,
        created_at INTEGER NOT NULL, 
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  });

  it('should delete oldest sessions when limit exceeded', async () => {
    const userId = 'user-1';
    
    await db.insert(schema.user).values({
      id: userId,
      email: 'test@example.com',
      name: 'Test',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await db.insert(schema.session).values({
        id: `session-${i}`,
        userId,
        token: `token-${i}`,
        expiresAt: new Date(now + 86400000),
        createdAt: new Date(now + i * 1000),
        updatedAt: new Date(now + i * 1000),
      } as any);
    }
    
    await enforceSessionLimit(db as any, userId, 3);
    
    const remaining = await db.select().from(schema.session).where(eq(schema.session.userId, userId));
    
    expect(remaining.length).toBe(3);
    expect(remaining.map(s => s.id)).toEqual(['session-2', 'session-3', 'session-4']);
  });

  it('should do nothing when unlimited', async () => {
    const userId = 'user-2';
    
    await db.insert(schema.user).values({
      id: userId,
      email: 'test2@example.com',
      name: 'Test 2',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    
    for (let i = 0; i < 5; i++) {
      await db.insert(schema.session).values({
        id: `session-${i}`,
        userId,
        token: `token-${i}`,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }
    
    await enforceSessionLimit(db as any, userId, 0);
    
    const remaining = await db.select().from(schema.session).where(eq(schema.session.userId, userId));
    expect(remaining.length).toBe(5);
  });
});
