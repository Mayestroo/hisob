import {
  Worker,
  ModelConfig,
  TicketFormState,
  Notification,
  PayrollPeriod,
  LicenseStatus,
  ModelPattaBatchConfig,
  PrintedPartyRecord,
  SubmittedTicketRecord
} from '../types/workbook';

export interface ActiveCellInfo {
  cellId: string;
  sheetName: string;
  value: string;
  formula?: string;
  isReadOnly?: boolean;
}

export interface ModalState {
  type:
    | 'new_operation'
    | 'delete_operation'
    | 'worker_manager'
    | 'backup_manager'
    | 'new_model'
    | 'period_manager'
    | 'license_activation'
    | 'developer_info'
    | 'patta_print'
    | 'worker_detail'
    | null;
  modelId?: string;
  opName?: string;
  workerId?: number;
  data?: any;
}

export interface ModelSlice {
  models: ModelConfig[];
  addModel: (
    name: string,
    options?: {
      templateType?: 'blank' | 'standard' | 'clone';
      cloneFromId?: string;
      title?: string;
      party?: string;
      color?: string;
      size?: string;
    }
  ) => void;
  deleteModel: (modelId: string) => void;
  renameModel: (modelId: string, newName: string) => void;
  syncNewOperation: (modelId: string, opName: string, rate: number) => void;
  syncDeleteOperation: (modelId: string, opName: string) => void;
  updateOperationRate: (modelId: string, opName: string, rate: number) => void;
  updateOperationName: (modelId: string, oldOpName: string, newOpName: string) => void;
  updateHisobQuantity: (modelId: string, workerId: number, opName: string, qty: number) => void;
  reorderOperations: (modelId: string, newOrder: string[]) => void;
}

export interface WorkerSlice {
  workers: Worker[];
  updateWorker: (workerId: number, updates: Partial<Worker>) => void;
  addWorker: (name: string) => void;
  deleteWorker: (workerId: number) => void;
}

export interface TicketSlice {
  ticketForms: Record<string, TicketFormState>;
  submittedTickets: SubmittedTicketRecord[];
  updateTicketField: (modelId: string, field: keyof TicketFormState, value: any) => void;
  setTicketWorker: (modelId: string, opName: string, workerId: string | number) => void;
  clearTicketForm: (modelId: string) => void;
  jonatish: (modelId: string) => Promise<boolean>;
  deleteSubmittedTicket: (ticketId: string) => Promise<void>;
}

export interface ArchivedPeriodData {
  period: PayrollPeriod;
  archivedAt: string;
  models: ModelConfig[];
  workers: Worker[];
  printedPartyHistory: PrintedPartyRecord[];
  submittedTickets: SubmittedTicketRecord[];
  pattaBatchConfigs?: Record<string, ModelPattaBatchConfig>;
  completedPartiesCount?: number;
  rolledOverPartiesCount?: number;
}

export interface PeriodSlice {
  currentPeriod: PayrollPeriod;
  periods: PayrollPeriod[];
  selectedArchiveFilename: string | null;
  selectedArchiveData: ArchivedPeriodData | null;
  startNewPeriod: (name: string, startDate: string) => Promise<void>;
  updateCurrentPeriod: (name: string, startDate: string) => Promise<void>;
  closeCurrentPeriod: (endDate: string, nextPeriodName?: string, nextStartDate?: string) => Promise<void>;
  loadArchivedPeriod: (filename: string | null) => Promise<void>;
}

export interface PattaBatchSlice {
  availableSizes: string[];
  nextPartyNumber: number;
  pattaBatchConfigs: Record<string, ModelPattaBatchConfig>;
  printedPartyHistory: PrintedPartyRecord[];
  addCustomSize: (sizeName: string) => void;
  deleteCustomSize: (sizeName: string) => void;
  incrementPartyNumber: (modelId: string, printedPartyStr: string) => void;
  updatePattaBatchConfig: (modelId: string, updates: Partial<ModelPattaBatchConfig>) => void;
  updatePattaBatchSize: (modelId: string, size: string, count: string) => void;
  addPrintedPartyRecord: (record: {
    partyNumber: string;
    modelId: string;
    modelName: string;
    color: string;
    pattaCount: number;
    ishSoni: number;
  }) => void;
  batchPrintCompleted: (
    printedItems: Array<{
      modelId: string;
      partyNumber: string;
      pattaCount: number;
      ishSoniPerPatta?: number;
      totalIshSoni?: number;
      ishSoni: number;
      sizes?: Record<string, string>;
      color: string;
    }>
  ) => void;
  deletePrintedPartyRecord: (id: string) => void;
  clearPrintedPartyHistory: () => void;
  confirmPartyActualQuantities: (partyRecordId: string) => Promise<void>;
  completePartySeries: () => Promise<void>;
}

export interface LicenseSlice {
  licenseStatus: LicenseStatus | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  checkLicense: () => Promise<void>;
  activateWithKey: (key: string) => Promise<{ success: boolean; error?: string }>;
}

export interface UiSlice {
  activeSheet: string;
  activeCell: ActiveCellInfo;
  notifications: Notification[];
  modalState: ModalState;
  loadingMessage: string | null;
  setActiveSheet: (sheetName: string) => void;
  setActiveCell: (info: ActiveCellInfo) => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  addNotification: (type: Notification['type'], title: string, message: string) => void;
  removeNotification: (id: string) => void;
  setLoadingMessage: (msg: string | null) => void;
}

export interface PersistenceSlice {
  isSaving: boolean;
  isServerConnected: boolean;
  deletedTicketIds?: string[];
  deletedPartyIds?: string[];
  deletedWorkerIds?: number[];
  deletedModelIds?: string[];
  initStore: (forcedCompanyId?: string) => Promise<void>;
  saveToDisk: (
    overrideState?: {
      workers?: Worker[];
      models?: ModelConfig[];
      ticketForms?: Record<string, TicketFormState>;
      pattaBatchConfigs?: Record<string, ModelPattaBatchConfig>;
      availableSizes?: string[];
      nextPartyNumber?: number;
      printedPartyHistory?: PrintedPartyRecord[];
      submittedTickets?: SubmittedTicketRecord[];
      currentPeriod?: PayrollPeriod;
      periods?: PayrollPeriod[];
      companyId?: string;
      deletedTicketIds?: string[];
      deletedPartyIds?: string[];
      deletedWorkerIds?: number[];
      deletedModelIds?: string[];
    },
    options?: { forceBackup?: boolean; companyId?: string; skipCloudSync?: boolean; skipReconcile?: boolean }
  ) => Promise<void>;
  exportExcel: () => void;
  resetToOriginal: () => Promise<void>;
  restoreFromCloud: (companyId?: string) => Promise<{ success: boolean; message?: string }>;
}

export type WorkbookStore = ModelSlice &
  WorkerSlice &
  TicketSlice &
  PeriodSlice &
  PattaBatchSlice &
  LicenseSlice &
  UiSlice &
  PersistenceSlice;
