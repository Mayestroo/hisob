import { StateCreator } from 'zustand';
import { WorkbookStore, WorkerSlice } from '../types';
import { Worker } from '../../types/workbook';
import { triggerDebouncedSave } from '../helpers/debounceSave';

export const createWorkerSlice: StateCreator<WorkbookStore, [], [], WorkerSlice> = (set, get) => ({
  workers: [],

  updateWorker: (workerId: number, updates: Partial<Worker>) => {
    const state = get();
    const sanitized = { ...updates };
    if (sanitized.avans !== undefined) sanitized.avans = Math.max(0, Number(sanitized.avans) || 0);
    if (sanitized.jarima !== undefined) sanitized.jarima = Math.max(0, Number(sanitized.jarima) || 0);
    if (sanitized.staj !== undefined) sanitized.staj = Math.max(0, Number(sanitized.staj) || 0);

    const updatedWorkers = state.workers.map((w) => {
      if (w.id === workerId) {
        return { ...w, ...sanitized, updatedAt: Date.now() };
      }
      return w;
    });

    set({ workers: updatedWorkers });
    triggerDebouncedSave(() => {
      get().saveToDisk({ workers: updatedWorkers });
    });
  },

  addWorker: (name: string) => {
    const state = get();
    const cleanName = name.trim();
    if (!cleanName) return;

    const maxId = state.workers.reduce((max, w) => Math.max(max, w.id), 0);
    const newWorker: Worker = {
      id: maxId + 1,
      name: cleanName,
      staj: 0,
      avans: 0,
      updatedAt: Date.now()
    };

    const updatedWorkers = [...state.workers, newWorker];
    set({ workers: updatedWorkers });
    get().saveToDisk({ workers: updatedWorkers });
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
