export function createIDBCache<T>(dbName: string, storeName: string, version: number, ttlMs: number) {
  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async get(key: string): Promise<T | null> {
      try {
        const db = await openDb();
        return new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).get(key);
          req.onsuccess = () => {
            const result = req.result;
            if (!result) return resolve(null);
            if (Date.now() - result.cachedAt > ttlMs) {
              const delTx = db.transaction(storeName, 'readwrite');
              delTx.objectStore(storeName).delete(key);
              resolve(null);
            } else {
              resolve(result.data);
            }
          };
          req.onerror = () => resolve(null);
        });
      } catch {
        return null;
      }
    },
    async set(key: string, data: T): Promise<void> {
      try {
        const db = await openDb();
        return new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put({ data, cachedAt: Date.now() }, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch {
        // ignore errors
      }
    },
    async clear(): Promise<void> {
      try {
        const db = await openDb();
        return new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch {
        // ignore errors
      }
    }
  };
}
