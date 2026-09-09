/**
 * Store Barrel Export — Phase 1
 * Atomic store'larga qulay kirish nuqtasi.
 */

import { useWorkbookStore } from './workbookStore';

// Clean selector hooks backed by unified useWorkbookStore
export const useWorkers = () => useWorkbookStore((s) => s.workers);
export const useWorker = (id: number) => useWorkbookStore((s) => s.workers.find((w) => w.id === id));
export const useWorkerActions = () =>
  useWorkbookStore((s) => ({
    addWorker: s.addWorker,
    updateWorker: s.updateWorker,
    deleteWorker: s.deleteWorker
  }));

export const useModels = () => useWorkbookStore((s) => s.models);
export const useModel = (id: string) => useWorkbookStore((s) => s.models.find((m) => m.id === id));
export const useModelActions = () =>
  useWorkbookStore((s) => ({
    addModel: s.addModel,
    deleteModel: s.deleteModel,
    renameModel: s.renameModel
  }));
export { useUIStore, useNotifications, useUIActions } from './uiStore';
export {
  useAuthStore,
  useCan,
  useCanAny,
  useUser,
  useRole,
  useAuthStatus,
  useCompanyId,
  useDeviceId,
  applyRolePermissions
} from './authStore';
export { useSyncStore, useSyncStatus, useSyncInfo } from './syncStore';

// Bridge
export { startStoreBridge, useStoreBridge, syncAtomicFromLegacy } from './bridge';

// Legacy store (backward compat)
export { useWorkbookStore } from './workbookStore';
export { DEFAULT_BATCH_SIZES } from '../constants/batchConstants';
export type { WorkbookStore, ActiveCellInfo, ModalState } from './types';
export type {
  Notification,
  ModalType,
  ModalState as UIModalState,
  ActiveCellInfo as UIActiveCellInfo
} from './uiStore';
export type { Role, Permission } from '../types/sync';
