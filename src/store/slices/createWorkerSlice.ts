import { StateCreator } from 'zustand';
import { WorkbookStore, WorkerSlice } from '../types';
import { Worker } from '../../types/workbook';
import { triggerDebouncedSave } from '../helpers/debounceSave';
import {
  cleanWorkerName,
  normalizeWorkerName,
  sanitizeWorkers
} from '../helpers/storeSanitizers';

export const createWorkerSlice: StateCreator<WorkbookStore, [], [], WorkerSlice> = (set, get) => ({
  workers: [],

  updateWorker: async (workerId: number, updates: Partial<Worker>, options?: { immediate?: boolean }) => {
    const state = get();
    const sanitized = { ...updates };
    if (sanitized.avans !== undefined) sanitized.avans = Math.max(0, Number(sanitized.avans) || 0);
    if (sanitized.jarima !== undefined) sanitized.jarima = Math.max(0, Number(sanitized.jarima) || 0);
    if (sanitized.staj !== undefined) sanitized.staj = Math.max(0, Number(sanitized.staj) || 0);
    if (sanitized.name) sanitized.name = cleanWorkerName(sanitized.name);

    const now = Date.now();
    const updatedWorkers = state.workers.map((w) => {
      if (w.id === workerId) {
        return { ...w, ...sanitized, updatedAt: now };
      }
      return w;
    });

    set({ workers: updatedWorkers });

    if (options?.immediate || sanitized.name !== undefined) {
      await get().saveToDisk({ workers: updatedWorkers });
    } else {
      triggerDebouncedSave(() => {
        get().saveToDisk({ workers: updatedWorkers });
      }, 1200, 'worker');
    }
  },

  addWorker: (name: string, initialData?: { staj?: number; avans?: number; jarima?: number; role?: string }) => {
    const state = get();
    const cleanName = cleanWorkerName(name);
    if (!cleanName) return;

    const norm = normalizeWorkerName(cleanName);
    const existing = state.workers.find((w) => normalizeWorkerName(w.name) === norm);
    if (existing) {
      state.addNotification('warning', "Ishchi allaqachon mavjud", `"${cleanName}" allaqachon #${existing.id} sifatida ro'yxatda bor.`);
      return;
    }

    // Monotonic collision-free ID across active workers, deleted workers, and historical tickets
    const usedIds = new Set<number>();
    for (const w of state.workers) {
      if (typeof w.id === 'number' && Number.isSafeInteger(w.id)) usedIds.add(w.id);
    }
    for (const dId of state.deletedWorkerIds || []) {
      if (typeof dId === 'number' && Number.isSafeInteger(dId)) usedIds.add(dId);
    }
    for (const t of state.submittedTickets || []) {
      for (const e of t.entries || []) {
        if (typeof e.workerId === 'number' && Number.isSafeInteger(e.workerId)) usedIds.add(e.workerId);
      }
    }
    const maxId = usedIds.size > 0 ? Math.max(...Array.from(usedIds)) : 0;
    const newWorkerId = maxId + 1;

    const newWorker: Worker = {
      id: newWorkerId,
      name: cleanName,
      staj: Math.max(0, Number(initialData?.staj) || 0),
      avans: Math.max(0, Number(initialData?.avans) || 0),
      jarima: Math.max(0, Number(initialData?.jarima) || 0),
      role: initialData?.role || undefined,
      updatedAt: Date.now()
    };

    const updatedWorkers = sanitizeWorkers([...state.workers, newWorker]);
    const updatedDeletedWorkerIds = (state.deletedWorkerIds || []).filter((id) => id !== newWorker.id);
    set({ workers: updatedWorkers, deletedWorkerIds: updatedDeletedWorkerIds });
    get().saveToDisk({ workers: updatedWorkers, deletedWorkerIds: updatedDeletedWorkerIds });
    state.addNotification('success', "Ishchi qo'shildi", `${newWorker.id}-raqamli yangi ishchi "${cleanName}" qo'shildi.`);
  },

  deleteWorker: (workerId: number) => {
    const state = get();
    const updatedWorkers = state.workers.filter((w) => w.id !== workerId);
    const updatedDeletedWorkerIds = Array.from(new Set([...(state.deletedWorkerIds || []), workerId]));
    set({ workers: updatedWorkers, deletedWorkerIds: updatedDeletedWorkerIds });
    get().saveToDisk({ workers: updatedWorkers, deletedWorkerIds: updatedDeletedWorkerIds });
  }
});
