import { create } from 'zustand';
import { WorkbookStore } from './types';
import { createUiSlice } from './slices/createUiSlice';
import { createLicenseSlice } from './slices/createLicenseSlice';
import { createWorkerSlice } from './slices/createWorkerSlice';
import { createPeriodSlice } from './slices/createPeriodSlice';
import { createModelSlice } from './slices/createModelSlice';
import { createPattaBatchSlice } from './slices/createPattaBatchSlice';
import { createTicketSlice } from './slices/createTicketSlice';
import { createPersistenceSlice } from './slices/createPersistenceSlice';

export const useWorkbookStore = create<WorkbookStore>((...args) => ({
  ...createUiSlice(...args),
  ...createLicenseSlice(...args),
  ...createWorkerSlice(...args),
  ...createPeriodSlice(...args),
  ...createModelSlice(...args),
  ...createPattaBatchSlice(...args),
  ...createTicketSlice(...args),
  ...createPersistenceSlice(...args)
}));

// Re-export constants and types for complete backward compatibility
export { DEFAULT_BATCH_SIZES } from '../constants/batchConstants';
export type { WorkbookStore, ActiveCellInfo, ModalState } from './types';
export default useWorkbookStore;
