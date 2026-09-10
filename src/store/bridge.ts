/**
 * Store Bridge — Phase 1
 * Atomic store'lar (worker, model, ui) va eski workbookStore o'rtasidagi
 * sinxronlikni ta'minlaydi. Hozircha legacy store'dan atomic store'ga
 * bir tomonlama sync qiladi.
 *
 * Eski kod: useWorkbookStore((s) => s.workers)
 * Yangi kod: useWorkerStore((s) => s.workers)
 *
 * Ikkalasi bir xil data ko'radi. Eski store'da update bo'lsa,
 * atomic store ham yangilanadi.
 */

import { useEffect } from 'react';
import { useWorkbookStore } from './workbookStore';
import { useUIStore } from './uiStore';
import { useAuthStore, applyRolePermissions } from './authStore';
import { initAutoSyncQueue, subscribeToCompany, flushOfflineQueue } from '../services/firebaseSync';
import { ensureAnonymousAuth } from '../services/firebaseAuth';
import { initDeviceRemoteListener } from '../services/deviceRemoteService';
import { mergeCloudSyncData } from './helpers/syncMerger';
import { sanitizeWorkers } from './helpers/storeSanitizers';

// License/role sync helper
export const syncLicenseAuth = (lic: any) => {
  if (!lic) {
    useAuthStore.getState().setAuth({
      status: 'pending_approval',
      role: null,
      companyId: null,
      user: null
    });
    return;
  }

  const companyId = lic.companyId;
  const machId = lic.machineId || useAuthStore.getState().deviceId;

  // Korxona biriktirish MAJBURIY: agar companyId yo'q bo'lsa yoki litsenziya faol bo'lmasa -> pending_approval
  if (!companyId || !lic.isActivated || lic.isBlocked) {
    useAuthStore.getState().setAuth({
      status: lic.isBlocked ? 'suspended' : 'pending_approval',
      role: null,
      companyId: companyId || null,
      user: lic.user || null,
      deviceId: machId
    });
    return;
  }

  const rawRole = lic.role;
  const role = (rawRole ? String(rawRole).toLowerCase() : 'admin') as
    | 'admin'
    | 'type'
    | 'print';
  useAuthStore.getState().setAuth({
    status: 'active',
    role,
    permissions: applyRolePermissions(role),
    companyId: companyId,
    user: lic.user || null,
    deviceId: machId
  });
};

let bridgeStarted = false;

export function startStoreBridge() {
  if (bridgeStarted) return;
  bridgeStarted = true;


  // UI sync
  useWorkbookStore.subscribe((state, prev) => {
    if (state.activeSheet !== prev.activeSheet) {
      useUIStore.getState().setActiveSheet(state.activeSheet);
    }
    if (state.notifications !== prev.notifications) {
      // Notifications atomic store boshqaradi, sync qilmaymiz
    }
  });

  // License/role sync subscription
  useWorkbookStore.subscribe((state, prev) => {
    if (state.licenseStatus !== prev.licenseStatus) {
      syncLicenseAuth(state.licenseStatus);
    }
  });

  // Initial sync for currently loaded license
  syncLicenseAuth(useWorkbookStore.getState().licenseStatus);
}

/**
 * React hook — bridge'ni App mount qilganda ishga tushirish
 */
export function useStoreBridge() {
  useEffect(() => {
    startStoreBridge();
    // Initial sync — legacy store'dan UI store'ga
    const legacy = useWorkbookStore.getState();
    useUIStore.getState().setActiveSheet(legacy.activeSheet);
    if (legacy.licenseStatus) {
      syncLicenseAuth(legacy.licenseStatus);
    }

    ensureAnonymousAuth().then((user) => {
      if (user) {
        flushOfflineQueue();
      }
    });
    const cleanupSync = initAutoSyncQueue();

    // Multi-User Real-time Sync Subscription from other PCs of the same company
    let activeCompanyId = legacy.licenseStatus?.companyId || null;
    let unsubCompany: (() => void) | null = null;
    const syncQueue: any[] = [];
    let isProcessingSyncQueue = false;

    const processSyncQueue = async (targetCompId: string) => {
      if (isProcessingSyncQueue) return;
      isProcessingSyncQueue = true;

      try {
        while (syncQueue.length > 0) {
          const companyData = syncQueue.shift();
          const syncData = companyData?.syncData;
          if (!syncData || !syncData.updatedAt) continue;

          const currentLic = useWorkbookStore.getState().licenseStatus;
          const myMachineId = currentLic?.machineId;
          const state = useWorkbookStore.getState();

          // Disaster Recovery: Agar lokal baza bo'sh bo'lsa (modellar, pattalar, partiyalar yo'q bo'lsa),
          // hatto o'zimizning kompyuter avval yozgan bo'lsa ham tiklaymiz!
          const isLocalEmpty =
            (!state.models || state.models.length === 0) &&
            (!state.submittedTickets || state.submittedTickets.length === 0) &&
            (!state.printedPartyHistory || state.printedPartyHistory.length === 0);

          // Agar o'zgarish o'zimizdan chiqqan bo'lsa va lokal baza bo'sh bo'lmasa, qayta ishlamaymiz
          if (myMachineId && syncData.updatedBy === myMachineId && !isLocalEmpty) {
            continue;
          }

          console.log(`[MultiSync] Korxona [${targetCompId}] bulutidan ma'lumotlar qabul qilindi (Manba: ${syncData.updatedBy || 'boshqa'})!`);

          try {
            const currentState = useWorkbookStore.getState();
            const merged = mergeCloudSyncData(currentState, syncData);

            const cleanMergedWorkers = sanitizeWorkers(merged.workers);

            // Store holatini to'liq yangilash
            useWorkbookStore.setState({
              submittedTickets: merged.submittedTickets,
              printedPartyHistory: merged.printedPartyHistory,
              nextPartyNumber: merged.nextPartyNumber,
              models: merged.models,
              workers: cleanMergedWorkers,
              currentPeriod: merged.currentPeriod,
              periods: merged.periods,
              availableSizes: merged.availableSizes,
              deletedTicketIds: merged.deletedTicketIds,
              deletedPartyIds: merged.deletedPartyIds,
              deletedWorkerIds: merged.deletedWorkerIds,
              deletedModelIds: merged.deletedModelIds
            });


            // Diskka ham saqlash
            const eAPI = (window as any).electronAPI;
            if (eAPI?.dbPatch) {
              await eAPI.dbPatch({
                submittedTickets: merged.submittedTickets,
                printedPartyHistory: merged.printedPartyHistory,
                nextPartyNumber: merged.nextPartyNumber,
                models: merged.models,
                workers: cleanMergedWorkers,
                currentPeriod: merged.currentPeriod,
                periods: merged.periods,
                availableSizes: merged.availableSizes,
                deletedTicketIds: merged.deletedTicketIds,
                deletedPartyIds: merged.deletedPartyIds,
                deletedWorkerIds: merged.deletedWorkerIds,
                deletedModelIds: merged.deletedModelIds,
                companyId: targetCompId
              }, { companyId: targetCompId });
            }
          } catch (itemErr) {
            console.warn('[MultiSync] Ma\'lumotlarni birlashtirishda xatolik:', itemErr);
          }
        }
      } finally {
        isProcessingSyncQueue = false;
      }
    };

    const setupCompanySync = (targetCompId: string | null) => {
      if (unsubCompany) {
        unsubCompany();
        unsubCompany = null;
      }
      if (!targetCompId || targetCompId === 'unassigned') {
        console.log('[MultiSync] Korxona hali biriktirilmagan, sinxronizatsiya kutilmoqda.');
        return;
      }
      activeCompanyId = targetCompId;
      console.log(`[MultiSync] Korxona sinxronizatsiyasi ulandi: ${targetCompId}`);
      unsubCompany = subscribeToCompany(targetCompId, (companyData) => {
        if (!companyData?.syncData?.updatedAt) return;
        syncQueue.push(companyData);
        processSyncQueue(targetCompId);
      });
    };

    setupCompanySync(activeCompanyId);

    let cleanupRemote: (() => void) | null = null;
    const unsubLicense = useWorkbookStore.subscribe((state, prev) => {
      const machId = state.licenseStatus?.machineId;
      if (machId && machId !== prev.licenseStatus?.machineId) {
        if (cleanupRemote) cleanupRemote();
        cleanupRemote = initDeviceRemoteListener(machId);
      }
      const newCompId = state.licenseStatus?.companyId || null;
      if (newCompId !== activeCompanyId) {
        setupCompanySync(newCompId);
      }
    });

    const initMachId = legacy.licenseStatus?.machineId;
    if (initMachId) {
      cleanupRemote = initDeviceRemoteListener(initMachId);
    }

    return () => {
      cleanupSync();
      if (unsubCompany) unsubCompany();
      unsubLicense();
      if (cleanupRemote) cleanupRemote();
    };
  }, []);
}

/**
 * Manual sync — bir martalik atomic store'larni legacy bilan sinxronlash
 */
export function syncAtomicFromLegacy() {
  const legacy = useWorkbookStore.getState();
  useUIStore.getState().setActiveSheet(legacy.activeSheet);
}
