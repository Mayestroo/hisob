/**
 * Offline Sync Queue (Native IndexedDB)
 * Phase 4 — Offline-First Architecture
 *
 * Internet uzilganda o'zgarishlarni mahalliy IndexedDB ga navbatga qo'yadi.
 * Internet paydo bo'lganda avtomatik ravishda Firebase RTDB ga yuboradi.
 */

export interface PendingSyncChange {
  id?: number;
  companyId: string;
  path: string;
  value: any;
  timestamp: number;
  action: 'set' | 'update' | 'remove';
  retryCount: number;
}

const DB_NAME = 'novda-offline-sync';
const DB_VERSION = 1;
const STORE_NAME = 'pendingSync';

let cachedDb: IDBDatabase | null = null;

function openNativeDB(): Promise<IDBDatabase> {
  if (cachedDb) {
    return Promise.resolve(cachedDb);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('by-timestamp', 'timestamp');
      }
    };

    request.onsuccess = () => {
      cachedDb = request.result;
      cachedDb.onversionchange = () => {
        cachedDb?.close();
        cachedDb = null;
      };
      resolve(cachedDb);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Navbatga yangi o'zgarish qo'shish
 */
export async function enqueueChange(
  companyId: string,
  path: string,
  value: any,
  action: 'set' | 'update' | 'remove' = 'set'
): Promise<number> {
  try {
    const db = await openNativeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item: PendingSyncChange = {
        companyId,
        path,
        value,
        timestamp: Date.now(),
        action,
        retryCount: 0
      };

      if (action === 'set') {
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          const list = (getAllReq.result as PendingSyncChange[]) || [];
          for (const it of list) {
            if (it.path === path && it.action === 'set' && it.id !== undefined) {
              store.delete(it.id);
            }
          }
          const addReq = store.add(item);
          addReq.onsuccess = () => resolve(addReq.result as number);
          addReq.onerror = () => reject(addReq.error);
        };
        getAllReq.onerror = () => reject(getAllReq.error);
      } else {
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result as number);
        req.onerror = () => reject(req.error);
      }
    });
  } catch (error) {
    console.error('[OfflineQueue] Enqueue xatosi:', error);
    return -1;
  }
}

/**
 * Navbatdagi barcha kutayotgan o'zgarishlarni olish
 */
export async function getPendingChanges(): Promise<PendingSyncChange[]> {
  try {
    const db = await openNativeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result as PendingSyncChange[]) || [];
        results.sort((a, b) => a.timestamp - b.timestamp);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('[OfflineQueue] GetPending xatosi:', error);
    return [];
  }
}

/**
 * Kutayotgan o'zgarishlar sonini olish
 */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openNativeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/**
 * Muvaffaqiyatli yuborilgan o'zgarishni navbatdan o'chirish
 */
export async function removePendingChange(id: number): Promise<void> {
  try {
    const db = await openNativeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('[OfflineQueue] Remove xatosi:', error);
  }
}

/**
 * Navbatni tozalash
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    const db = await openNativeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('[OfflineQueue] Clear xatosi:', error);
  }
}
