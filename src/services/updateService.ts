import { ref, onValue, set } from 'firebase/database';
import { getFirebaseDB, IS_FIREBASE_CONFIGURED } from '../config/firebase';
import { cleanForFirebase } from './firebaseSync';
import { useWorkbookStore } from '../store/workbookStore';
import { AppUpdateInfo, UpdateProgress } from '../types/update';

export const CURRENT_APP_VERSION = (import.meta.env.VITE_APP_VERSION as string) || '1.5.9';

/**
 * Versiyalarni solishtirish (semver)
 * remoteVersion > currentVersion bo'lsa true qaytaradi
 */
export function isNewerVersion(remoteVersion: string, currentVersion: string = CURRENT_APP_VERSION): boolean {
  try {
    const clean = (v: string) => v.replace(/^v/i, '').trim();
    const rParts = clean(remoteVersion).split('.').map((p) => parseInt(p, 10) || 0);
    const cParts = clean(currentVersion).split('.').map((p) => parseInt(p, 10) || 0);

    const maxLen = Math.max(rParts.length, cParts.length, 3);
    for (let i = 0; i < maxLen; i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Firebase Realtime Database orqali yangilanishlarni real vaqtda kuzatish
 */
export function subscribeToAppUpdates(): () => void {
  const db = getFirebaseDB();
  if (!IS_FIREBASE_CONFIGURED || !db) {
    return () => {};
  }

  const updateRef = ref(db, 'app_updates');
  const unsubscribe = onValue(
    updateRef,
    (snapshot) => {
      const val = snapshot.val() as AppUpdateInfo | null;
      if (val && val.version && val.downloadUrl) {
        if (isNewerVersion(val.version, CURRENT_APP_VERSION)) {
          useWorkbookStore.getState().setAvailableUpdate(val);
        } else {
          useWorkbookStore.getState().setAvailableUpdate(null);
        }
      } else {
        useWorkbookStore.getState().setAvailableUpdate(null);
      }
    },
    (err) => {
      console.warn('[UpdateService] Update check warning:', err);
    }
  );

  return unsubscribe;
}

/**
 * Yangi versiyani Firebase bazasiga chiqarish (Admin / Developer uchun)
 */
export async function publishAppUpdate(updateInfo: AppUpdateInfo): Promise<boolean> {
  const db = getFirebaseDB();
  if (!IS_FIREBASE_CONFIGURED || !db) {
    throw new Error('Firebase ulanmagan');
  }

  const updateRef = ref(db, 'app_updates');
  const cleaned = cleanForFirebase({
    ...updateInfo,
    publishedAt: updateInfo.publishedAt || new Date().toISOString()
  });

  await set(updateRef, cleaned);
  return true;
}

/**
 * Electron orqali yuklab olish va o'rnatish
 */
export async function startDownloadAndInstall(
  updateInfo: AppUpdateInfo,
  onProgress?: (progress: UpdateProgress) => void
): Promise<{ success: boolean; error?: string }> {
  const eAPI = (window as any).electronAPI;
  if (!eAPI?.downloadAppUpdate) {
    // Agar brauzerda bo'lsa, to'g'ridan-to'g'ri havolani ochamiz
    window.open(updateInfo.downloadUrl, '_blank');
    return { success: true };
  }

  let cleanupProgress: (() => void) | undefined;
  if (onProgress && eAPI.onUpdateProgress) {
    cleanupProgress = eAPI.onUpdateProgress(onProgress);
  }

  try {
    const dlResult = await eAPI.downloadAppUpdate({
      url: updateInfo.downloadUrl,
      version: updateInfo.version
    });

    if (!dlResult || !dlResult.success) {
      throw new Error(dlResult?.error || 'Yuklab olishda xatolik yuz berdi');
    }

    // O'rnatishni boshlash
    const instResult = await eAPI.installAppUpdate({
      filePath: dlResult.filePath
    });

    if (!instResult || !instResult.success) {
      throw new Error(instResult?.error || 'O\'rnatishda xatolik yuz berdi');
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Yangilanishda xatolik' };
  } finally {
    if (cleanupProgress) cleanupProgress();
  }
}
