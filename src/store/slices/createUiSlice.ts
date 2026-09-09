import { StateCreator } from 'zustand';
import { WorkbookStore, UiSlice, ActiveCellInfo, ModalState } from '../types';
import { Notification } from '../../types/workbook';
import { DEFAULT_ACTIVE_SHEET } from '../../constants/sheetConstants';

export const createUiSlice: StateCreator<WorkbookStore, [], [], UiSlice> = (set, get) => ({
  activeSheet: DEFAULT_ACTIVE_SHEET,
  activeCell: {
    cellId: 'A3',
    sheetName: DEFAULT_ACTIVE_SHEET,
    value: '',
    formula: ''
  },
  notifications: [],
  modalState: { type: null },
  loadingMessage: null,

  setLoadingMessage: (msg: string | null) => set({ loadingMessage: msg }),

  setActiveSheet: (sheetName: string) => {
    set({ activeSheet: sheetName });
  },

  setActiveCell: (info: ActiveCellInfo) => {
    const cur = get().activeCell;
    if (
      cur &&
      cur.cellId === info.cellId &&
      cur.sheetName === info.sheetName &&
      cur.value === info.value &&
      cur.formula === info.formula
    ) {
      return;
    }
    set({ activeCell: info });
  },

  openModal: (modal: ModalState) => {
    set({ modalState: modal });
  },

  closeModal: () => {
    set({ modalState: { type: null } });
  },

  addNotification: (type: Notification['type'], title: string, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => {
      // Bir xil nom va xabarga ega bildirishnoma allaqachon ekranda tursa, uni takrorlamaymiz
      const isDuplicate = state.notifications.some(
        (n) => n.title === title && n.message === message
      );
      if (isDuplicate) return state;

      const updated = [...state.notifications, { id, type, title, message, timestamp: Date.now() }];
      return { notifications: updated.slice(-4) };
    });

    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      }));
    }, 4500);
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }));
  }
});
