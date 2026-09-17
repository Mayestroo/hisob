import { StateCreator } from 'zustand';
import { WorkbookStore, PersistenceSlice } from '../types';
import { Worker, ModelConfig } from '../../types/workbook';
import { DEFAULT_BATCH_SIZES } from '../../constants/batchConstants';
import { STORAGE_KEY } from '../../constants/sheetConstants';
import { exportWorkbookToExcel, exportWorkersListToExcel } from '../../engine/excelSync';
import {
  sanitizeWorkers,
  sanitizeModels,
  sanitizeForms,
  sanitizePattaBatchConfigs,
  sanitizePrintedPartyHistory,
  reconcileModelHisobQuantities
} from '../helpers/storeSanitizers';
import { padZero } from '../../utils/formatters';
import { syncWrite, fetchCompanyCloudData, fetchCompanyArchives } from '../../services/firebaseSync';
import { mergeCloudSyncData } from '../helpers/syncMerger';
import { useAuthStore } from '../authStore';

export const createPersistenceSlice: StateCreator<WorkbookStore, [], [], PersistenceSlice> = (set, get) => ({
  isSaving: false,
  isServerConnected: false,

  initStore: async (forcedCompanyId?: string) => {
    // Check license first
    await get().checkLicense();
    const currentCompanyId = forcedCompanyId || get().licenseStatus?.companyId || useAuthStore.getState().companyId || 'comp_novda';

    const eAPI = (window as any).electronAPI;

    // Electron IPC mode
    if (eAPI) {
      try {
        const result = await eAPI.dbRead(currentCompanyId);
        let companyData = result?.success && result.data ? result.data : null;

        // Local data truly belongs to this company
        if (companyData && companyData.companyId && companyData.companyId !== currentCompanyId) {
          companyData = null;
        }

        const isLocalEmpty =
          !companyData ||
          ((!companyData.models || companyData.models.length === 0) &&
           (!companyData.submittedTickets || companyData.submittedTickets.length === 0) &&
           (!companyData.printedPartyHistory || companyData.printedPartyHistory.length === 0));

        if (isLocalEmpty && currentCompanyId && currentCompanyId !== 'unassigned') {
          console.log(`[Store] Mahalliy diskda korxona (${currentCompanyId}) ma'lumotlari yo'q, bulutdan tekshirilmoqda...`);
          try {
            const cloudData = await fetchCompanyCloudData(currentCompanyId);
            if (cloudData && (cloudData.models?.length > 0 || cloudData.submittedTickets?.length > 0 || cloudData.workers?.length > 0)) {
              console.log(`[Store] Bulutdan ${cloudData.models?.length || 0} ta model va ${cloudData.submittedTickets?.length || 0} ta patta tiklandi!`);
              let cleanModels = sanitizeModels(cloudData.models || []);
              const cleanWorkers = sanitizeWorkers(cloudData.workers || []);
              const partyHistory = sanitizePrintedPartyHistory(cloudData.printedPartyHistory || []);
              const allNums = new Set(
                partyHistory.map((h) => parseInt(String(h.partyNumber).trim(), 10)).filter((n) => !isNaN(n) && n > 0)
              );
              let lowestUnused = 1;
              while (allNums.has(lowestUnused)) {
                lowestUnused++;
              }
              const nextParty = Math.max(cloudData.nextPartyNumber || 1, lowestUnused);
              const subTickets = cloudData.submittedTickets || [];
              cleanModels = reconcileModelHisobQuantities(cleanModels, subTickets);
              const periods = cloudData.periods || [];
              const currentPeriod = cloudData.currentPeriod || {
                id: 'period_default',
                name: '2026-Avgust oyligi',
                startDate: new Date().toISOString().slice(0, 7) + '-01',
                isClosed: false
              };
              const customSizes = Array.isArray(cloudData.availableSizes) && cloudData.availableSizes.length > 0
                ? cloudData.availableSizes
                : [...DEFAULT_BATCH_SIZES];

              const newState = {
                workers: cleanWorkers,
                models: cleanModels,
                availableSizes: customSizes,
                nextPartyNumber: nextParty,
                printedPartyHistory: partyHistory,
                submittedTickets: subTickets,
                currentPeriod,
                periods,
                ticketForms: sanitizeForms(null, cleanModels),
                pattaBatchConfigs: sanitizePattaBatchConfigs(null, cleanModels, nextParty, customSizes),
                isServerConnected: true
              };

              set(newState);

              // Save to company-specific local disk
              if (eAPI?.dbWrite) {
                eAPI.dbWrite({ ...newState, companyId: currentCompanyId }, { companyId: currentCompanyId }).catch(() => {});
              }
              return;
            }
          } catch (cloudErr) {
            console.warn('[Store] Bulutdan tekshirishda xatolik:', cloudErr);
          }

          // Yangi ochilgan, hali bulutda ham ma'lumoti bo'lmagan toza korxona
          console.log(`[Store] Yangi korxona (${currentCompanyId}) uchun toza, bo'sh baza ochilmoqda...`);
          const cleanModels: ModelConfig[] = [];
          const cleanWorkers: Worker[] = [];
          const nextParty = 1;
          const customSizes = [...DEFAULT_BATCH_SIZES];
          const freshPeriod = {
            id: 'period_default',
            name: `${new Date().getFullYear()}-${new Date().toLocaleDateString('uz-UZ', { month: 'long' })} oyligi`,
            startDate: new Date().toISOString().slice(0, 7) + '-01',
            isClosed: false
          };

          const freshState: Partial<WorkbookStore> = {
            workers: cleanWorkers,
            models: cleanModels,
            availableSizes: customSizes,
            nextPartyNumber: nextParty,
            printedPartyHistory: [],
            submittedTickets: [],
            currentPeriod: freshPeriod,
            periods: [],
            ticketForms: {},
            pattaBatchConfigs: {},
            activeSheet: 'Patta-Hisob',
            isServerConnected: true
          };

          set(freshState);

          if (eAPI.dbWrite) {
            await eAPI.dbWrite({ ...freshState, companyId: currentCompanyId }, { companyId: currentCompanyId });
          }
          return;
        }

        if (companyData) {
          let {
            workers,
            models,
            ticketForms,
            pattaBatchConfigs,
            currentPeriod,
            periods,
            printedPartyHistory,
            submittedTickets
          } = companyData;
          let cleanModels = sanitizeModels(models);
          const subTickets = submittedTickets || [];
          cleanModels = reconcileModelHisobQuantities(cleanModels, subTickets);
          const cleanHistory = sanitizePrintedPartyHistory(printedPartyHistory || []);
          const allNums = new Set(
            cleanHistory.map((h) => parseInt(String(h.partyNumber).trim(), 10)).filter((n) => !isNaN(n) && n > 0)
          );
          let lowestUnused = 1;
          while (allNums.has(lowestUnused)) {
            lowestUnused++;
          }
          let nextParty = Math.max(companyData.nextPartyNumber || 1, lowestUnused);
          const customSizes =
            Array.isArray(companyData.availableSizes) && companyData.availableSizes.length > 0
              ? companyData.availableSizes
              : [...DEFAULT_BATCH_SIZES];

          set({
            workers: sanitizeWorkers(workers || []),
            models: cleanModels,
            availableSizes: customSizes,
            nextPartyNumber: nextParty,
            printedPartyHistory: cleanHistory,
            submittedTickets: submittedTickets || [],
            currentPeriod: currentPeriod || {
              id: 'period_default',
              name: '2026-Avgust oyligi',
              startDate: new Date().toISOString().slice(0, 7) + '-01',
              isClosed: false
            },
            periods: periods || [],
            ticketForms: sanitizeForms(ticketForms, cleanModels),
            pattaBatchConfigs: sanitizePattaBatchConfigs(
              pattaBatchConfigs,
              cleanModels,
              nextParty,
              customSizes
            ),
            deletedTicketIds: companyData.deletedTicketIds || [],
            deletedPartyIds: companyData.deletedPartyIds || [],
            deletedWorkerIds: companyData.deletedWorkerIds || [],
            deletedModelIds: companyData.deletedModelIds || [],
            isServerConnected: true
          });
          console.log(`[Store] Loaded via Electron IPC for [${currentCompanyId}].`);

          // Asynchronously verify if cloud has newer data from another workstation
          if (currentCompanyId && currentCompanyId !== 'unassigned' && navigator.onLine) {
            fetchCompanyCloudData(currentCompanyId).then((cloudData) => {
              if (cloudData && cloudData.updatedAt) {
                const localUpdated = companyData.updatedAt ? new Date(companyData.updatedAt).getTime() : 0;
                if (cloudData.updatedAt > localUpdated) {
                  console.log(`[Store] Startup: Cloud has newer data (${new Date(cloudData.updatedAt).toLocaleTimeString()}), applying merge...`);
                  const merged = mergeCloudSyncData(get(), cloudData);
                  set({
                    workers: sanitizeWorkers(merged.workers),
                    models: merged.models,
                    nextPartyNumber: merged.nextPartyNumber,
                    printedPartyHistory: merged.printedPartyHistory,
                    submittedTickets: merged.submittedTickets,
                    currentPeriod: merged.currentPeriod,
                    periods: merged.periods,
                    availableSizes: merged.availableSizes,
                    deletedTicketIds: merged.deletedTicketIds,
                    deletedPartyIds: merged.deletedPartyIds,
                    deletedWorkerIds: merged.deletedWorkerIds,
                    deletedModelIds: merged.deletedModelIds
                  });
                }
              }
            }).catch((err) => {
              console.warn('[Store] Startup cloud check warning:', err);
            });
          }
          return;
        }
      } catch (e) {
        console.warn('[Store] Electron IPC read failed', e);
      }
      return;
    }

    // Web / HTTP mode
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const { workers, models, ticketForms, pattaBatchConfigs, currentPeriod, periods } = json.data;
          const customSizes =
            Array.isArray(json.data.availableSizes) && json.data.availableSizes.length > 0
              ? json.data.availableSizes
              : [...DEFAULT_BATCH_SIZES];
          set({
            workers: sanitizeWorkers(workers),
            models: sanitizeModels(models || []),
            availableSizes: customSizes,
            currentPeriod: currentPeriod || {
              id: 'period_default',
              name: '2026-Avgust oyligi',
              startDate: new Date().toISOString().slice(0, 7) + '-01',
              isClosed: false
            },
            periods: periods || [],
            ticketForms: ticketForms || {},
            pattaBatchConfigs: pattaBatchConfigs || {},
            isServerConnected: true
          });
          return;
        }
      }
    } catch (e) {
      console.warn('[Store] HTTP API not reachable, falling back to localStorage.', e);
    }

    // Fallback to local storage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const rawTickets = parsed.submittedTickets || [];
        const cleanModels = reconcileModelHisobQuantities(sanitizeModels(parsed.models || []), rawTickets);
        set({
          workers: sanitizeWorkers(parsed.workers || []),
          models: cleanModels,
          submittedTickets: rawTickets,
          printedPartyHistory: sanitizePrintedPartyHistory(parsed.printedPartyHistory || []),
          currentPeriod: parsed.currentPeriod || {
            id: 'period_default',
            name: '2026-Avgust oyligi',
            startDate: new Date().toISOString().slice(0, 7) + '-01',
            isClosed: false
          },
          periods: parsed.periods || [],
          ticketForms: parsed.ticketForms || {},
          pattaBatchConfigs: parsed.pattaBatchConfigs || {},
          isServerConnected: false
        });
      }
    } catch (e) {
      console.error('Error reading localStorage', e);
    }
  },

  saveToDisk: async (overrideState, options) => {
    const state = get();
    const rawTickets = overrideState?.submittedTickets || state.submittedTickets || [];
    let rawModels = overrideState?.models || state.models;
    if (!options?.skipReconcile) {
      rawModels = reconcileModelHisobQuantities(rawModels, rawTickets);
    }

    const payload = {
      workers: sanitizeWorkers(overrideState?.workers || state.workers),
      models: rawModels,
      availableSizes: overrideState?.availableSizes || state.availableSizes || [...DEFAULT_BATCH_SIZES],
      ticketForms: overrideState?.ticketForms || state.ticketForms,
      pattaBatchConfigs: overrideState?.pattaBatchConfigs || state.pattaBatchConfigs,
      nextPartyNumber:
        overrideState?.nextPartyNumber !== undefined
          ? overrideState.nextPartyNumber
          : state.nextPartyNumber || 1,
      printedPartyHistory: overrideState?.printedPartyHistory || state.printedPartyHistory || [],
      submittedTickets: rawTickets,
      currentPeriod: overrideState?.currentPeriod || state.currentPeriod,
      periods: overrideState?.periods || state.periods,
      deletedTicketIds: overrideState?.deletedTicketIds || state.deletedTicketIds || [],
      deletedPartyIds: overrideState?.deletedPartyIds || state.deletedPartyIds || [],
      deletedWorkerIds: overrideState?.deletedWorkerIds || state.deletedWorkerIds || [],
      deletedModelIds: overrideState?.deletedModelIds || state.deletedModelIds || []
    };

    const eAPI = (window as any).electronAPI;

    // Multi-User Cloud Sync (Online bo'lsa Firebase'ga, oflayn bo'lsa IndexedDB navbatiga)
    if (!options?.skipCloudSync) {
      try {
        const machineId = state.licenseStatus?.machineId || 'device_' + (typeof window !== 'undefined' ? window.navigator.userAgent.slice(0, 10) : 'local');
        let syncPayload: Record<string, any> | null = null;
        let writeMode: 'set' | 'update' = 'set';

        if (overrideState) {
          // Faqat o'zgargan maydonlarni (delta) jo'natamiz, shunda patta kiritganda ishchilar ro'yxati qayta yozilmaydi
          writeMode = 'update';
          syncPayload = {
            updatedAt: Date.now(),
            updatedBy: machineId
          };
          if (overrideState.submittedTickets !== undefined) syncPayload.submittedTickets = rawTickets;
          if (overrideState.models !== undefined) syncPayload.models = rawModels;
          if (overrideState.printedPartyHistory !== undefined) syncPayload.printedPartyHistory = overrideState.printedPartyHistory;
          if (overrideState.nextPartyNumber !== undefined) syncPayload.nextPartyNumber = overrideState.nextPartyNumber;
          if (overrideState.workers !== undefined) syncPayload.workers = sanitizeWorkers(overrideState.workers);
          if (overrideState.currentPeriod !== undefined) syncPayload.currentPeriod = overrideState.currentPeriod;
          if (overrideState.periods !== undefined) syncPayload.periods = overrideState.periods;
          if (overrideState.availableSizes !== undefined) syncPayload.availableSizes = overrideState.availableSizes;
          if (overrideState.deletedTicketIds !== undefined) syncPayload.deletedTicketIds = overrideState.deletedTicketIds;
          if (overrideState.deletedPartyIds !== undefined) syncPayload.deletedPartyIds = overrideState.deletedPartyIds;
          if (overrideState.deletedWorkerIds !== undefined) syncPayload.deletedWorkerIds = overrideState.deletedWorkerIds;
          if (overrideState.deletedModelIds !== undefined) syncPayload.deletedModelIds = overrideState.deletedModelIds;
        } else {
          // Manual disk save / Ctrl+S: faqat lokal disk va zaxirani yangilaydi.
          // Boshqa kompyuterlardagi yangi ma'lumotlarni tasodifan eski massiv bilan
          // qayta yozib yubormaslik uchun overrideState bo'lmaganda bulutga to'liq massiv yuborilmaydi.
          syncPayload = null;
        }

        if (syncPayload) {
          const companyId = overrideState?.companyId || options?.companyId || state.licenseStatus?.companyId || useAuthStore.getState().companyId || 'comp_novda';
          syncWrite(companyId, 'syncData', syncPayload, writeMode);
        }
      } catch (e) {
        console.warn('[Store] Cloud sync write error:', e);
      }
    }

    // Electron IPC mode - asynchronous serialized disk persistence
    if (eAPI) {
      try {
        const companyId = overrideState?.companyId || options?.companyId || state.licenseStatus?.companyId || useAuthStore.getState().companyId || 'comp_novda';
        const writeOpts = { ...options, companyId };
        let result: any;
        if (overrideState && !options?.forceBackup && eAPI.dbPatch) {
          result = await eAPI.dbPatch({ ...overrideState, companyId }, writeOpts);
        } else {
          result = await eAPI.dbWrite({ ...payload, companyId }, writeOpts);
        }
        if (result?.success) {
          if (!state.isServerConnected) {
            set({ isServerConnected: true });
          }
        } else {
          console.error('[Store] Electron IPC write failed:', result?.error);
          state.addNotification('error', 'Saqlash xatosi', result?.error || "Mahalliy diskka saqlab bo'lmadi");
        }
      } catch (e: any) {
        console.warn('[Store] Electron IPC write exception:', e);
        state.addNotification('error', 'Disk xatosi', e?.message || "Mahalliy diskka yozishda uzilish yuz berdi");
      }
      return;
    }

    // Web / HTTP mode
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then((res) => {
          if (res.ok && !state.isServerConnected) set({ isServerConnected: true });
        })
        .catch(() => {});
    } catch (e) {
      console.warn('[Store] Web fallback save failed', e);
    }
  },

  exportExcel: () => {
    const { models, workers } = get();
    exportWorkbookToExcel(models, workers);
    get().addNotification('success', 'Yuklab olindi', 'Excel (.xlsx) fayli muvaffaqiyatli saqlandi!');
  },

  exportWorkersExcel: () => {
    const { workers } = get();
    exportWorkersListToExcel(workers);
    get().addNotification('success', 'Yuklab olindi', "Ishchilar ro'yxati Excel (.xlsx) fayli muvaffaqiyatli saqlandi!");
  },

  resetToOriginal: async () => {
    const state = get();
    const ok = await state.confirmAction({
      title: "Dastlabki holatga qaytarish",
      message: "Haqiqatan ham barcha hisob-kitoblarni dastlabki (toza) holatga qaytarmoqchimisiz?\n\nESLATMA: Barcha mavjud modellar va ishchilar to'liq saqlanadi, faqat kiritilgan sonlar va hisob-kitoblar nollanadi.\nJoriy barcha ma'lumotlaringiz xavfsizlik uchun avtomatik 'Zaxiralar' ro'yxatiga to'liq saqlanadi.",
      confirmText: "Ha, tozalansin",
      isDanger: true
    });

    if (!ok) {
      return;
    }

    set({ loadingMessage: 'Dastlabki holatga keltirilmoqda...' });

    try {
      // 1. Automatically create pre-reset backup
      const eAPI = (window as any).electronAPI;
      const now = new Date();
      const ts = `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-${padZero(now.getDate())}_${padZero(now.getHours())}-${padZero(now.getMinutes())}-${padZero(now.getSeconds())}`;
      const backupFilename = `backup_before_reset_${ts}.json`;

      const currentDb = {
        workers: state.workers,
        models: state.models,
        ticketForms: state.ticketForms,
        pattaBatchConfigs: state.pattaBatchConfigs,
        submittedTickets: state.submittedTickets,
        printedPartyHistory: state.printedPartyHistory,
        currentPeriod: state.currentPeriod,
        periods: state.periods
      };

      if (eAPI && eAPI.archiveSave) {
        await eAPI.archiveSave(backupFilename, currentDb);
      }

      // 2. Perform clean reset PRESERVING ALL user-created models, operations and workers
      const cleanModels = state.models.map((m) => ({
        ...m,
        hisobQuantities: {}
      }));

      const cleanWorkers = state.workers.map((w) => ({
        ...w,
        avans: 0,
        jarima: 0
      }));

      const cleanForms: Record<string, any> = {};
      for (const m of cleanModels) {
        cleanForms[m.id] = {
          date: new Date().toISOString().slice(0, 10),
          party: '',
          color: m.color || 'Кора',
          size: m.size || 'M',
          qty: '',
          patta: '1',
          entries: {}
        };
      }

      const cleanBatches: Record<string, any> = {};
      for (const m of cleanModels) {
        cleanBatches[m.id] = {
          partyNumber: '1',
          totalIshSoni: '',
          color: m.color || 'Кора',
          sizes: {}
        };
      }

      const firstSheetName = cleanModels[0]?.name || 'Umumiy';
      const newState = {
        workers: cleanWorkers,
        models: cleanModels,
        ticketForms: cleanForms,
        pattaBatchConfigs: state.pattaBatchConfigs || cleanBatches,
        submittedTickets: state.submittedTickets || [],
        printedPartyHistory: state.printedPartyHistory || [],
        nextPartyNumber: state.nextPartyNumber || 1,
        activeSheet: firstSheetName,
        activeCell: {
          cellId: 'A3',
          sheetName: firstSheetName,
          value: '',
          formula: ''
        }
      };

      set(newState);
      await get().saveToDisk(newState);
      get().addNotification(
        'success',
        'Tozalandi',
        "Hisob-kitoblar dastlabki holatga keltirildi. Barcha modellar, ishchilar va Pattalar monitoringi to'liq saqlab qolindi."
      );
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setTimeout(() => {
        set({ loadingMessage: null });
      }, 400);
    }
  },

  restoreFromCloud: async (targetCompanyId?: string) => {
    const compId = targetCompanyId || get().licenseStatus?.companyId;
    if (!compId || compId === 'unassigned') {
      get().addNotification('warning', 'Korxona yo\'q', 'Ushbu kompyuterga korxona biriktirilmagan!');
      return { success: false, message: 'Korxona biriktirilmagan' };
    }

    try {
      get().setLoadingMessage(`${compId} bulutidan ma'lumotlar tiklanmoqda...`);
      const cloudData = await fetchCompanyCloudData(compId);
      if (!cloudData) {
        get().addNotification('warning', 'Bulut bo\'sh', 'Bulutda ushbu korxona uchun ma\'lumot topilmadi.');
        return { success: false, message: 'Bulutda ma\'lumot topilmadi' };
      }

      const cleanModels = sanitizeModels(cloudData.models || []);
      const cleanWorkers = sanitizeWorkers(cloudData.workers || []);
      const cleanHistory = sanitizePrintedPartyHistory(cloudData.printedPartyHistory || []);
      const activeNums = new Set(
        cleanHistory.filter((h) => !h.isClosed).map((h) => parseInt(h.partyNumber, 10)).filter((n) => !isNaN(n))
      );
      let lowestUnused = 1;
      while (activeNums.has(lowestUnused)) {
        lowestUnused++;
      }
      const tickets = cloudData.submittedTickets || [];
      const nextParty = lowestUnused;
      const customSizes =
        Array.isArray(cloudData.availableSizes) && cloudData.availableSizes.length > 0
          ? cloudData.availableSizes
          : get().availableSizes;

      const restoredPeriods = Array.isArray(cloudData.periods) ? cloudData.periods : get().periods;
      const restoredCurrentPeriod = cloudData.currentPeriod || get().currentPeriod;

      set({
        models: cleanModels,
        workers: cleanWorkers,
        printedPartyHistory: cleanHistory,
        submittedTickets: tickets,
        nextPartyNumber: nextParty,
        availableSizes: customSizes,
        deletedTicketIds: cloudData.deletedTicketIds || [],
        deletedPartyIds: cloudData.deletedPartyIds || [],
        deletedWorkerIds: cloudData.deletedWorkerIds || [],
        deletedModelIds: cloudData.deletedModelIds || [],
        periods: restoredPeriods,
        currentPeriod: restoredCurrentPeriod,
        ticketForms: sanitizeForms(get().ticketForms, cleanModels),
        pattaBatchConfigs: sanitizePattaBatchConfigs(
          get().pattaBatchConfigs,
          cleanModels,
          nextParty,
          customSizes
        )
      });

      // Diskka yozish
      const eAPI = (window as any).electronAPI;
      if (eAPI && eAPI.dbWrite) {
        await eAPI.dbWrite({
          workers: cleanWorkers,
          models: cleanModels,
          availableSizes: customSizes,
          nextPartyNumber: nextParty,
          printedPartyHistory: cleanHistory,
          submittedTickets: tickets,
          currentPeriod: restoredCurrentPeriod,
          periods: restoredPeriods,
          deletedTicketIds: cloudData.deletedTicketIds || [],
          deletedPartyIds: cloudData.deletedPartyIds || [],
          deletedWorkerIds: cloudData.deletedWorkerIds || [],
          deletedModelIds: cloudData.deletedModelIds || []
        });
      }

      // O'tgan oylar arxivlarini ham yuklab diskka saqlash
      if (eAPI && eAPI.archiveSave) {
        try {
          const allArchives = await fetchCompanyArchives(compId);
          if (allArchives) {
            for (const [key, arcData] of Object.entries(allArchives)) {
              const arcFilename = key.endsWith('.json') ? key : `${key}.json`;
              await eAPI.archiveSave(arcFilename, arcData);
            }
            console.log(`[Store] ${Object.keys(allArchives).length} ta oylik arxivi bulutdan yuklandi.`);
          }
        } catch (arcErr) {
          console.warn('[Store] Arxivlarni tiklashda ogohlantirish:', arcErr);
        }
      }

      get().addNotification(
        'success',
        'Bulutdan tiklandi',
        `[${compId}] korxonasining barcha ma'lumotlari muvaffaqiyatli tiklandi!`
      );
      return { success: true };
    } catch (err: any) {
      console.error('[Store] Bulutdan tiklash xatosi:', err);
      get().addNotification('error', 'Xatolik', err.message || 'Bulutdan tiklashda xatolik yuz berdi');
      return { success: false, message: err.message };
    } finally {
      get().setLoadingMessage(null);
    }
  }
});
