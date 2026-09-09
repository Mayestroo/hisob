/**
 * Firebase Realtime Database Sync Service
 * Phase 4 — Multi-User Sync & Offline-First
 */

import { ref, onValue, set, update, get } from 'firebase/database';
import { getFirebaseDB, IS_FIREBASE_CONFIGURED } from '../config/firebase';
import {
  enqueueChange,
  getPendingChanges,
  removePendingChange,
  getPendingCount
} from './offlineQueue';

let syncActive = false;
let isFlushing = false;

/**
 * Kompaniya ma'lumotlariga real-time obuna bo'lish
 */
export function subscribeToCompany(
  companyId: string,
  onData: (data: any) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDB();
  if (!IS_FIREBASE_CONFIGURED || !db) {
    return () => {};
  }

  const companyRef = ref(db, `companies/${companyId}`);
  const unsubscribe = onValue(
    companyRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val) {
        onData(val);
      }
    },
    (error) => {
      console.error('[FirebaseSync] Obuna xatosi:', error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Ma'lumotni saqlash yoki yangilash (Online bo'lsa Firebase'ga, oflayn bo'lsa IndexedDB navbatiga)
 */
export async function syncWrite(
  companyId: string,
  subPath: string,
  data: any,
  mode: 'set' | 'update' = 'update'
): Promise<boolean> {
  const db = getFirebaseDB();
  const fullPath = `companies/${companyId}/${subPath}`;

  if (IS_FIREBASE_CONFIGURED && db && navigator.onLine) {
    try {
      const targetRef = ref(db, fullPath);
      if (mode === 'set') {
        await set(targetRef, data);
      } else {
        await update(targetRef, data);
      }
      return true;
    } catch (err) {
      console.warn('[FirebaseSync] To\'g\'ridan-to\'g\'ri yozish muvaffaqiyatsiz, navbatga olinadi:', err);
    }
  }

  // Oflayn navbatga saqlash
  await enqueueChange(companyId, fullPath, data, mode);
  return false;
}

/**
 * Oflayn navbatdagi barcha o'zgarishlarni Firebase'ga yuklash
 */
export async function flushOfflineQueue(): Promise<{ sent: number; remaining: number }> {
  if (isFlushing || !navigator.onLine) return { sent: 0, remaining: await getPendingCount() };

  const db = getFirebaseDB();
  if (!IS_FIREBASE_CONFIGURED || !db) return { sent: 0, remaining: 0 };

  isFlushing = true;
  let sent = 0;

  try {
    const changes = await getPendingChanges();
    for (const item of changes) {
      try {
        const itemRef = ref(db, item.path);
        if (item.action === 'set') {
          await set(itemRef, item.value);
        } else {
          await update(itemRef, item.value);
        }
        if (item.id !== undefined) {
          await removePendingChange(item.id);
        }
        sent++;
      } catch (itemErr) {
        console.warn(`[FirebaseSync] Elementni sinxronlashda xatolik (path: ${item.path}):`, itemErr);
        break; // keyingi urinish uchun to'xtatamiz
      }
    }
  } finally {
    isFlushing = false;
  }

  const remaining = await getPendingCount();
  return { sent, remaining };
}

/**
 * Avtomatik oflayn navbatni tinglash (online bo'lganda flush qilish)
 */
export function initAutoSyncQueue(): () => void {
  if (syncActive) return () => {};
  syncActive = true;

  const handleOnline = () => {
    console.log('[FirebaseSync] Tarmoq tiklandi, oflayn navbat yuborilmoqda...');
    flushOfflineQueue();
  };

  window.addEventListener('online', handleOnline);

  // Dastlabki tekshiruv
  if (navigator.onLine) {
    flushOfflineQueue();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    syncActive = false;
  };
}

/**
 * Korxona bulutidagi so'nggi syncData holatini yuklab olish (Disaster Recovery)
 */
export async function fetchCompanyCloudData(companyId: string): Promise<any | null> {
  if (!companyId || companyId === 'unassigned') {
    return null;
  }

  // 1. Firebase SDK orqali olish
  const db = getFirebaseDB();
  if (IS_FIREBASE_CONFIGURED && db) {
    try {
      const companyRef = ref(db, `companies/${companyId}/syncData`);
      const snapshot = await get(companyRef);
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val) {
          console.log(`[FirebaseSync] Bulutdan ma'lumotlar muvaffaqiyatli olindi: ${companyId}`);
          return val;
        }
      }
    } catch (e) {
      console.warn('[FirebaseSync] SDK orqali syncData o\'qib bo\'lmadi, REST API ga murojaat qilinadi:', e);
    }
  }

  // 2. Fallback: REST API orqali to'g'ridan-to'g'ri GET so'rov
  try {
    const url = `https://hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app/companies/${companyId}/syncData.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        console.log(`[FirebaseSync] REST API orqali bulut ma'lumotlari olindi: ${companyId}`);
        return data;
      }
    }
  } catch (e) {
    console.error('[FirebaseSync] REST API orqali syncData olishda xatolik:', e);
  }

  return null;
}

/**
 * Yopilgan oylik arxivini Firebase bulutiga saqlash
 */
export async function saveCompanyArchive(
  companyId: string,
  archiveKey: string,
  archiveData: any
): Promise<boolean> {
  if (!companyId || companyId === 'unassigned' || !archiveKey) {
    return false;
  }
  const cleanKey = archiveKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  return syncWrite(companyId, `archives/${cleanKey}`, archiveData, 'set');
}

/**
 * Korxonaning barcha yopilgan oylik arxivlarini bulutdan olish
 */
export async function fetchCompanyArchives(companyId: string): Promise<Record<string, any> | null> {
  if (!companyId || companyId === 'unassigned') {
    return null;
  }

  const db = getFirebaseDB();
  if (IS_FIREBASE_CONFIGURED && db) {
    try {
      const archivesRef = ref(db, `companies/${companyId}/archives`);
      const snapshot = await get(archivesRef);
      if (snapshot.exists()) {
        return snapshot.val();
      }
    } catch (e) {
      console.warn('[FirebaseSync] SDK orqali arxivlar o\'qilmadi, REST ga o\'tiladi:', e);
    }
  }

  try {
    const url = `https://hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app/companies/${companyId}/archives.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data || null;
    }
  } catch (e) {
    console.error('[FirebaseSync] REST API orqali arxivlar olish xatosi:', e);
  }

  return null;
}

/**
 * Aniq bitta yopilgan oylik arxivini bulutdan olish
 */
export async function fetchCompanyArchiveFile(
  companyId: string,
  archiveKey: string
): Promise<any | null> {
  if (!companyId || companyId === 'unassigned' || !archiveKey) {
    return null;
  }

  const cleanKey = archiveKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const db = getFirebaseDB();
  if (IS_FIREBASE_CONFIGURED && db) {
    try {
      const archiveRef = ref(db, `companies/${companyId}/archives/${cleanKey}`);
      const snapshot = await get(archiveRef);
      if (snapshot.exists()) {
        return snapshot.val();
      }
    } catch (e) {
      console.warn('[FirebaseSync] SDK archive file error:', e);
    }
  }

  try {
    const url = `https://hisobchi-c930c-default-rtdb.asia-southeast1.firebasedatabase.app/companies/${companyId}/archives/${cleanKey}.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data || null;
    }
  } catch (e) {
    console.error('[FirebaseSync] REST archive file error:', e);
  }

  return null;
}
