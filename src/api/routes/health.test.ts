import { describe, it, expect, vi } from 'vitest';
import { app } from '../app';
import { testDb } from '../../test/setup';

describe('Health Check API', () => {
  describe('Liveness Check (Shallow)', () => {
    it.each([
      ['/api/healthz'],
      ['/api/ping']
    ])('returns 200 and does not query the database for %s', async (path) => {
      const spy = vi.spyOn(testDb, 'run');

      const res = await app.request(path, {
        method: 'GET'
      }, {
        DB: (testDb as unknown as { $client: D1Database }).$client || (testDb as unknown as D1Database)
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { status: string; timestamp: string };
      expect(json.status).toBe('ok');
      expect(json.timestamp).toBeDefined();
      expect(spy).not.toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  describe('Readiness Check (Deep)', () => {
    it.each([
      ['/api/readyz'],
      ['/api/status'],
      ['/api/health']
    ])('returns 200 and database status when DB is healthy for %s', async (path) => {
      const spy = vi.spyOn(testDb, 'run');

      const res = await app.request(path, {
        method: 'GET'
      }, {
        DB: (testDb as unknown as { $client: D1Database }).$client || (testDb as unknown as D1Database)
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { status: string; database: string; timestamp: string };
      expect(json.status).toBe('ok');
      expect(json.database).toBe('connected');
      expect(json.timestamp).toBeDefined();
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it.each([
      ['/api/readyz'],
      ['/api/status'],
      ['/api/health']
    ])('returns 500 when DB query fails for %s', async (path) => {
      // Mock testDb.run to simulate a query execution failure
      const spy = vi.spyOn(testDb, 'run').mockRejectedValueOnce(new Error('Database connection lost'));

      const res = await app.request(path, {
        method: 'GET'
      }, {
        DB: (testDb as unknown as { $client: D1Database }).$client || (testDb as unknown as D1Database)
      });

      expect(res.status).toBe(500);
      const json = await res.json() as { status: string; database: string; error: string; timestamp: string };
      expect(json.status).toBe('error');
      expect(json.database).toBe('disconnected');
      expect(json.error).toBe('Database connection lost');

      spy.mockRestore();
    });
  });
});
