import { StateCreator } from 'zustand';
import { WorkbookStore, PeriodSlice } from '../types';
import { createInitialTicketForms } from '../helpers/storeSanitizers';
import { buildPartyTicketsList } from '../../domain/partyAnalytics';
import { DEFAULT_BATCH_SIZES } from '../../constants/batchConstants';
import { PrintedPartyRecord, SubmittedTicketRecord } from '../../types/workbook';
import { getUzbekMonthName } from '../../utils/formatters';
import { saveCompanyArchive, fetchCompanyArchiveFile } from '../../services/firebaseSync';

const defaultStartDate = new Date().toISOString().slice(0, 7) + '-01';
const defaultPeriodName = getUzbekMonthName(defaultStartDate);

export const createPeriodSlice: StateCreator<WorkbookStore, [], [], PeriodSlice> = (set, get) => ({
  currentPeriod: {
    id: 'period_default',
    name: defaultPeriodName,
    startDate: defaultStartDate,
    isClosed: false
  },
  periods: [],
  selectedArchiveFilename: null,
  selectedArchiveData: null,

  startNewPeriod: async (name: string, startDate: string) => {
    const state = get();
    const newPeriod = {
      id: `period_${Date.now()}`,
      name: name.trim() || getUzbekMonthName(startDate),
      startDate: startDate || new Date().toISOString().slice(0, 10),
      isClosed: false
    };

    set({
      currentPeriod: newPeriod,
      selectedArchiveFilename: null,
      selectedArchiveData: null
    });
    await state.saveToDisk({ currentPeriod: newPeriod });
    state.addNotification('success', 'Yangi davr boshlandi', `"${newPeriod.name}" davri ochildi (${newPeriod.startDate}).`);
  },

  updateCurrentPeriod: async (name: string, startDate: string) => {
    const state = get();
    const cleanDate = startDate || state.currentPeriod.startDate;
    const cleanName = name.trim() || state.currentPeriod.name || getUzbekMonthName(cleanDate);
    const updated = {
      ...state.currentPeriod,
      name: cleanName,
      startDate: cleanDate
    };
    set({ currentPeriod: updated });
    await state.saveToDisk({ currentPeriod: updated });
    state.addNotification('success', 'Davr yangilandi', `Joriy oylik "${updated.name}" deb saqlandi (${updated.startDate}).`);
  },

  loadArchivedPeriod: async (filename: string | null) => {
    const state = get();
    if (!filename) {
      set({ selectedArchiveFilename: null, selectedArchiveData: null });
      return;
    }

    const eAPI = (window as any).electronAPI;
    const companyId = state.licenseStatus?.companyId;
    if (eAPI && eAPI.archiveRead) {
      try {
        const res = await eAPI.archiveRead(filename, companyId);
        if (res.success && res.data) {
          set({ selectedArchiveFilename: filename, selectedArchiveData: res.data });
          state.addNotification('info', 'Arxiv yuklandi', `"${res.data.period?.name || filename}" arxivi ko'rish uchun ochildi.`);
          return;
        }
      } catch (err) {
        console.warn('Electron archiveRead error:', err);
      }
    }

    // Bulutdan o'qish (Disaster Recovery fallback)
    if (companyId && companyId !== 'unassigned') {
      try {
        const archiveKey = filename.replace(/\.json$/, '');
        const cloudData = await fetchCompanyArchiveFile(companyId, archiveKey);
        if (cloudData) {
          set({ selectedArchiveFilename: filename, selectedArchiveData: cloudData });
          if (eAPI && eAPI.archiveSave) {
            eAPI.archiveSave(filename, cloudData).catch(() => {});
          }
          state.addNotification('info', 'Bulutdan yuklandi', `"${cloudData.period?.name || filename}" arxivi bulutdan muvaffaqiyatli ochildi.`);
          return;
        }
      } catch (cloudErr) {
        console.warn('[PeriodSlice] Bulutdan arxiv olishda xatolik:', cloudErr);
      }
    }

    try {
      const res = await fetch(`/api/archive/${filename}`);
      if (res.ok) {
        const data = await res.json();
        set({ selectedArchiveFilename: filename, selectedArchiveData: data });
        state.addNotification('info', 'Arxiv yuklandi', `"${data.period?.name || filename}" arxivi ko'rish uchun ochildi.`);
      }
    } catch (e) {
      console.warn('Failed to load archive data', e);
      state.addNotification('error', 'Arxiv yuklanmadi', 'Arxiv faylini o\'qishda xatolik yuz berdi.');
    }
  },

  closeCurrentPeriod: async (endDate: string, nextPeriodName?: string, nextStartDate?: string) => {
    const state = get();
    const cleanDate = endDate || new Date().toISOString().slice(0, 10);
    const archiveFilename = `archive_${Date.now()}_${state.currentPeriod.name.replace(/[^a-zA-Z0-9_\u0400-\u04FF-]/g, '_')}.json`;

    const closedPeriod = {
      ...state.currentPeriod,
      endDate: cleanDate,
      isClosed: true,
      closedAt: new Date().toISOString(),
      archiveFilename
    };

    const activeSizes = state.availableSizes && state.availableSizes.length > 0 ? state.availableSizes : DEFAULT_BATCH_SIZES;

    // 1. Separate parties into fully completed vs incomplete (unsubmitted pattas remaining)
    const completedParties: PrintedPartyRecord[] = [];
    const incompleteParties: PrintedPartyRecord[] = [];

    for (const record of (state.printedPartyHistory || [])) {
      const tickets = buildPartyTicketsList(record, state.submittedTickets || [], activeSizes, true);
      const prevArchived = new Set(record.archivedPattaNumbers || []);
      const newlySubmitted = tickets.filter((t) => t.isSubmitted).map((t) => t.pattaNumber);
      const totalCompleted = new Set([...prevArchived, ...newlySubmitted]);
      const totalPattas = tickets.length;
      const isComplete = totalPattas > 0 && totalCompleted.size >= totalPattas;

      if (isComplete) {
        completedParties.push(record);
      } else {
        incompleteParties.push(record);
      }
    }

    // 2. Prepare full archive payload with ALL current data and statistics
    const archivePayload = {
      period: closedPeriod,
      archivedAt: new Date().toISOString(),
      models: state.models,
      workers: state.workers,
      printedPartyHistory: state.printedPartyHistory,
      submittedTickets: state.submittedTickets,
      pattaBatchConfigs: state.pattaBatchConfigs,
      completedPartiesCount: completedParties.length,
      rolledOverPartiesCount: incompleteParties.length
    };

    // Save archive to Electron disk
    const eAPI = (window as any).electronAPI;
    const companyId = state.licenseStatus?.companyId;
    if (eAPI && eAPI.archiveSave) {
      try {
        await eAPI.archiveSave(archiveFilename, archivePayload, companyId);
      } catch (err) {
        console.warn('Failed to save archive in Electron', err);
      }
    }

    // 2.5 Save archive to Firebase Cloud for Multi-Device & Disaster Recovery
    if (companyId && companyId !== 'unassigned') {
      const archiveKey = archiveFilename.replace(/\.json$/, '');
      saveCompanyArchive(companyId, archiveKey, archivePayload).catch((err) => {
        console.warn('[PeriodSlice] Arxivni Firebase bulutiga saqlashda ogohlantirish:', err);
      });
    }

    // Post to archive API (for web fallback)
    try {
      await fetch('/api/archive-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archivePayload)
      });
    } catch (e) {
      console.warn('Failed to call archive API', e);
    }

    // 3. Prepare workspace for the next period:
    // Reset quantities in models, reset avans to 0 (PRESERVE: workers, oklad, staj, operations, rates!)
    const cleanModels = state.models.map((m) => ({
      ...m,
      hisobQuantities: {}
    }));

    const cleanWorkers = state.workers.map((w) => ({
      ...w,
      avans: 0,
      jarima: 0
    }));

    // Incomplete parties roll over to the new month!
    // Any pattas that were submitted in the closed month are added to archivedPattaNumbers,
    // so they do not show up as entered in the new month, but are prevented from duplicate submission!
    const cleanPartyHistory: PrintedPartyRecord[] = incompleteParties.map((p) => {
      const tickets = buildPartyTicketsList(p, state.submittedTickets || [], activeSizes, true);
      const newlySubmittedPNums = tickets.filter((t) => t.isSubmitted).map((t) => t.pattaNumber);
      const prevArchived = p.archivedPattaNumbers || [];
      const allArchived = Array.from(new Set([...prevArchived, ...newlySubmittedPNums]));

      return {
        ...p,
        archivedPattaNumbers: allArchived
      };
    });

    // In the new month, submittedTickets starts completely fresh (0 tickets entered in the new month)!
    // All submitted tickets from the closed month are safely preserved in the archive!
    const cleanSubmittedTickets: SubmittedTicketRecord[] = [];

    const updatedPeriods = [closedPeriod, ...state.periods];
    const finalNextStartDate = nextStartDate || closedPeriod.endDate;
    const finalNextPeriodName = nextPeriodName?.trim() || getUzbekMonthName(finalNextStartDate);

    const nextPeriod = {
      id: `period_${Date.now()}`,
      name: finalNextPeriodName,
      startDate: finalNextStartDate,
      isClosed: false
    };

    const cleanForms = createInitialTicketForms(cleanModels);

    set({
      models: cleanModels,
      workers: cleanWorkers,
      currentPeriod: nextPeriod,
      periods: updatedPeriods,
      ticketForms: cleanForms,
      printedPartyHistory: cleanPartyHistory,
      submittedTickets: cleanSubmittedTickets,
      selectedArchiveFilename: null,
      selectedArchiveData: null
    });

    await state.saveToDisk({
      models: cleanModels,
      workers: cleanWorkers,
      currentPeriod: nextPeriod,
      periods: updatedPeriods,
      ticketForms: cleanForms,
      printedPartyHistory: cleanPartyHistory,
      submittedTickets: cleanSubmittedTickets
    }, { forceBackup: true });

    state.addNotification(
      'success',
      'Davr muvaffaqiyatli arxivlandi',
      `"${closedPeriod.name}" yopildi. To'liq kiritilgan ${completedParties.length} ta partiya arxivga o'tdi. To'ldirilmagan ${incompleteParties.length} ta partiya yangi oyga o'tkazildi!`
    );
  }
});
