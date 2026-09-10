import { StateCreator } from 'zustand';
import { WorkbookStore, ModelSlice } from '../types';
import { ModelConfig } from '../../types/workbook';
import { STANDARD_OPERATIONS } from '../../constants/operationConstants';
import { triggerDebouncedSave } from '../helpers/debounceSave';

export const createModelSlice: StateCreator<WorkbookStore, [], [], ModelSlice> = (set, get) => ({
  models: [],

  addModel: (name, options) => {
    const state = get();
    const cleanName = name.trim().replace(/\s+/g, '-');
    if (!cleanName) return;

    if (
      state.models.some(
        (m) =>
          m.name.toLowerCase() === cleanName.toLowerCase() ||
          m.id.toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      state.addNotification('error', 'Mavjud', `"${cleanName}" nomli model allaqachon mavjud!`);
      return;
    }

    let operations: any[] = [];
    let pattaOpsOrder: string[] = [];

    if (options?.templateType === 'clone' && options.cloneFromId) {
      const source = state.models.find((m) => m.id === options.cloneFromId);
      if (source) {
        operations = source.operations.map((op, idx) => ({
          id: `op_${Date.now()}_${idx}`,
          name: op.name,
          rate: op.rate
        }));
        pattaOpsOrder = [...source.pattaOpsOrder];
      }
    } else if (options?.templateType === 'standard' || !options?.templateType) {
      operations = STANDARD_OPERATIONS.map((op, idx) => ({
        id: `op_${Date.now()}_${idx}`,
        name: op.name,
        rate: op.rate
      }));
      pattaOpsOrder = STANDARD_OPERATIONS.map((o) => o.name);
    }

    const newModel: ModelConfig = {
      id: cleanName,
      name: cleanName,
      hisobSheetName: `${cleanName}-hisob`,
      title: options?.title || `Модел- ${cleanName}`,
      party: options?.party || '',
      color: options?.color || 'Кора',
      size: options?.size || 'XL',
      operations,
      pattaOpsOrder,
      hisobQuantities: {}
    };

    const updatedModels = [...state.models, newModel];
    const updatedTicketForms = {
      ...state.ticketForms,
      [cleanName]: {
        date: new Date().toISOString().slice(0, 10),
        party: options?.party || '',
        color: options?.color || 'Кора',
        size: options?.size || 'XL',
        qty: '',
        patta: '1',
        entries: {}
      }
    };
    const updatedPattaBatches = {
      ...state.pattaBatchConfigs,
      [cleanName]: {
        partyNumber: '',
        isCustomParty: false,
        totalIshSoni: '',
        color: options?.color || 'Кора',
        sizes: {}
      }
    };

    set({
      models: updatedModels,
      ticketForms: updatedTicketForms,
      pattaBatchConfigs: updatedPattaBatches,
      activeSheet: cleanName
    });
    get().saveToDisk({
      models: updatedModels,
      ticketForms: updatedTicketForms,
      pattaBatchConfigs: updatedPattaBatches
    });
    state.addNotification(
      'success',
      "Model qo'shildi",
      `"${cleanName}" va "${cleanName}-hisob" tayyor shablon bilan yaratildi!`
    );
  },

  deleteModel: (modelId) => {
    const state = get();
    if (state.models.length <= 1) {
      state.addNotification('error', 'Xatolik', "Oxirgi modelni o'chirib bo'lmaydi.");
      return;
    }

    const updatedModels = state.models.filter((m) => m.id !== modelId);
    const updatedDeletedModelIds = Array.from(new Set([...(state.deletedModelIds || []), modelId]));
    const nextSheet = updatedModels[0]?.name || 'Umumiy';
    set({ models: updatedModels, activeSheet: nextSheet, deletedModelIds: updatedDeletedModelIds });
    get().saveToDisk({ models: updatedModels, deletedModelIds: updatedDeletedModelIds });
    state.addNotification('info', "O'chirildi", "Model va uning hisob varag'i o'chirildi.");
  },

  renameModel: (modelId, newName) => {
    const cleanName = newName.trim().replace(/-hisob$/i, '');
    if (!cleanName) return;
    const state = get();
    if (
      state.models.some(
        (m) => m.id !== modelId && m.name.toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      state.addNotification('warning', 'Mavjud nom', `"${cleanName}" nomli model allaqachon mavjud.`);
      return;
    }

    const targetModel = state.models.find((m) => m.id === modelId || m.name === modelId);
    if (!targetModel) return;
    const oldId = targetModel.id;

    const updatedModels = state.models.map((m) => {
      if (m.id !== oldId) return m;
      return {
        ...m,
        id: cleanName,
        name: cleanName,
        hisobSheetName: `${cleanName}-hisob`,
        title: `Модел- ${cleanName}`
      };
    });

    // Migrate ticket forms
    const updatedTicketForms = { ...state.ticketForms };
    if (updatedTicketForms[oldId]) {
      updatedTicketForms[cleanName] = updatedTicketForms[oldId];
      if (oldId !== cleanName) delete updatedTicketForms[oldId];
    }

    // Migrate patta batch configs
    const updatedPattaBatches = { ...state.pattaBatchConfigs };
    if (updatedPattaBatches[oldId]) {
      updatedPattaBatches[cleanName] = updatedPattaBatches[oldId];
      if (oldId !== cleanName) delete updatedPattaBatches[oldId];
    }

    // Migrate submitted tickets
    const updatedTickets = (state.submittedTickets || []).map((t) => {
      if (t.modelId === oldId) {
        return { ...t, modelId: cleanName };
      }
      return t;
    });

    // Migrate printed party history
    const updatedHistory = (state.printedPartyHistory || []).map((h) => {
      if (h.modelId === oldId) {
        return { ...h, modelId: cleanName, modelName: cleanName };
      }
      return h;
    });

    let currentActive = state.activeSheet;
    if (currentActive === targetModel.name || currentActive === targetModel.id || currentActive === oldId) {
      currentActive = cleanName;
    } else if (
      currentActive === targetModel.hisobSheetName ||
      currentActive === `${oldId}-hisob` ||
      currentActive === `${targetModel.name}-hisob`
    ) {
      currentActive = `${cleanName}-hisob`;
    }

    set({
      models: updatedModels,
      ticketForms: updatedTicketForms,
      pattaBatchConfigs: updatedPattaBatches,
      submittedTickets: updatedTickets,
      printedPartyHistory: updatedHistory,
      activeSheet: currentActive
    });

    get().saveToDisk({
      models: updatedModels,
      ticketForms: updatedTicketForms,
      pattaBatchConfigs: updatedPattaBatches,
      submittedTickets: updatedTickets,
      printedPartyHistory: updatedHistory
    });

    state.addNotification('success', 'Nomlandi', `Model nomi "${cleanName}" ga o'zgartirildi.`);
  },

  syncNewOperation: (modelId: string, opName: string, rate: number) => {
    const state = get();
    const cleanOpName = opName.trim();
    if (!cleanOpName) return;

    const updatedModels = state.models.map((m) => {
      if (m.id === modelId) {
        if (m.operations.some((op) => op.name.toLowerCase() === cleanOpName.toLowerCase())) {
          state.addNotification('info', 'Mavjud', 'Bu operatsiya allaqachon mavjud.');
          return m;
        }

        const newOp = {
          id: `op_${Date.now()}`,
          name: cleanOpName,
          rate: Number(rate) || 0
        };

        const rawOps = [...m.operations, newOp];
        const updatedOps = rawOps.map((op, idx) => ({
          ...op,
          col: 3 + idx * 2,
          id: op.id || `op_${3 + idx * 2}`
        }));

        const updatedPattaOrder = m.pattaOpsOrder.includes(cleanOpName)
          ? m.pattaOpsOrder
          : [...m.pattaOpsOrder, cleanOpName];

        return {
          ...m,
          operations: updatedOps,
          pattaOpsOrder: updatedPattaOrder
        };
      }
      return m;
    });

    set({ models: updatedModels });
    get().saveToDisk({ models: updatedModels });
    state.addNotification('success', "Qo'shildi", `'${cleanOpName}' bazaga va Excelga qo'shildi!`);
  },

  syncDeleteOperation: (modelId: string, opName: string) => {
    const state = get();
    const cleanOpName = opName.trim();
    if (!cleanOpName) return;

    const targetOpLower = cleanOpName.toLowerCase();

    const updatedModels = state.models.map((m) => {
      if (m.id === modelId) {
        const filteredOps = m.operations.filter(
          (op) => op.name.trim().toLowerCase() !== targetOpLower
        );
        const updatedOps = filteredOps.map((op, idx) => ({
          ...op,
          col: 3 + idx * 2,
          id: op.id || `op_${3 + idx * 2}`
        }));

        const updatedPattaOrder = m.pattaOpsOrder.filter(
          (op) => op.trim().toLowerCase() !== targetOpLower
        );

        const updatedHisobQuantities: Record<number, Record<string, number>> = {};
        for (const [wIdStr, opMap] of Object.entries(m.hisobQuantities || {})) {
          const wId = Number(wIdStr);
          const newOpMap: Record<string, number> = {};
          for (const [k, v] of Object.entries(opMap)) {
            if (k.trim().toLowerCase() !== targetOpLower) {
              newOpMap[k] = v;
            }
          }
          updatedHisobQuantities[wId] = newOpMap;
        }

        return {
          ...m,
          operations: updatedOps,
          pattaOpsOrder: updatedPattaOrder,
          hisobQuantities: updatedHisobQuantities
        };
      }
      return m;
    });

    // Also clean up form entry atomically
    const currentForm = state.ticketForms[modelId];
    let updatedForms = state.ticketForms;
    if (currentForm && currentForm.entries) {
      const newEntries = { ...currentForm.entries };
      for (const k of Object.keys(newEntries)) {
        if (k.trim().toLowerCase() === targetOpLower) {
          delete newEntries[k];
        }
      }
      updatedForms = {
        ...state.ticketForms,
        [modelId]: {
          ...currentForm,
          entries: newEntries
        }
      };
    }

    set({
      models: updatedModels,
      ticketForms: updatedForms
    });

    get().saveToDisk({ models: updatedModels, ticketForms: updatedForms });
    state.addNotification('info', "O'chirildi", `"${cleanOpName}" operatsiyasi muvaffaqiyatli o'chirildi.`);
  },

  updateOperationRate: (modelId: string, opName: string, rate: number) => {
    const state = get();
    const updatedModels = state.models.map((m) => {
      if (m.id === modelId) {
        const updatedOps = m.operations.map((op) => {
          if (op.name === opName) {
            return { ...op, rate: Number(rate) || 0 };
          }
          return op;
        });
        return { ...m, operations: updatedOps };
      }
      return m;
    });

    set({ models: updatedModels });
    triggerDebouncedSave(() => {
      get().saveToDisk({ models: updatedModels });
    });
  },

  updateOperationName: (modelId: string, oldOpName: string, newOpName: string) => {
    const state = get();
    const cleanNewName = newOpName.trim();
    if (!cleanNewName || cleanNewName === oldOpName) return;

    const updatedModels = state.models.map((m) => {
      if (m.id === modelId) {
        const updatedOps = m.operations.map((op) => {
          if (op.name === oldOpName) {
            return { ...op, name: cleanNewName };
          }
          return op;
        });

        const updatedPattaOrder = m.pattaOpsOrder.map((name) =>
          name === oldOpName ? cleanNewName : name
        );

        const updatedHisobQuantities: Record<number, Record<string, number>> = {};
        for (const [wIdStr, opMap] of Object.entries(m.hisobQuantities || {})) {
          const wId = Number(wIdStr);
          const newOpMap: Record<string, number> = {};
          for (const [k, v] of Object.entries(opMap)) {
            if (k === oldOpName) {
              newOpMap[cleanNewName] = v;
            } else {
              newOpMap[k] = v;
            }
          }
          updatedHisobQuantities[wId] = newOpMap;
        }

        return {
          ...m,
          operations: updatedOps,
          pattaOpsOrder: updatedPattaOrder,
          hisobQuantities: updatedHisobQuantities
        };
      }
      return m;
    });

    set({ models: updatedModels });
    get().saveToDisk({ models: updatedModels });
    state.addNotification('success', 'Nom yangilandi', `"${oldOpName}" nomi "${cleanNewName}" ga o'zgartirildi.`);
  },

  updateHisobQuantity: (modelId: string, workerId: number, opName: string, qty: number) => {
    const state = get();
    const updatedModels = state.models.map((m) => {
      if (m.id === modelId) {
        const hq = m.hisobQuantities || {};
        const currentWorkerOps = { ...(hq[workerId] || {}) };
        if (qty <= 0) {
          delete currentWorkerOps[opName];
        } else {
          currentWorkerOps[opName] = qty;
        }
        return {
          ...m,
          hisobQuantities: {
            ...hq,
            [workerId]: currentWorkerOps
          }
        };
      }
      return m;
    });

    set({ models: updatedModels });
    triggerDebouncedSave(() => {
      get().saveToDisk({ models: updatedModels }, { skipReconcile: true });
    });
  },

  reorderOperations: (modelId: string, newOrder: string[]) => {
    const state = get();
    const model = state.models.find((m) => m.id === modelId);
    if (!model) return;

    const currentOpsMap = new Map<string, typeof model.operations[0]>();
    for (const op of model.operations) {
      currentOpsMap.set(op.name, op);
    }

    const reorderedOps: typeof model.operations = [];
    for (let i = 0; i < newOrder.length; i++) {
      const opName = newOrder[i];
      const existing = currentOpsMap.get(opName);
      if (existing) {
        reorderedOps.push({
          ...existing,
          col: 3 + i * 2,
          id: `op_${3 + i * 2}`
        });
      }
    }

    for (const op of model.operations) {
      if (!newOrder.includes(op.name)) {
        const col = 3 + reorderedOps.length * 2;
        reorderedOps.push({ ...op, col, id: `op_${col}` });
      }
    }

    const finalOrder = reorderedOps.map((o) => o.name);

    const updatedModels = state.models.map((m) => {
      if (m.id === modelId) {
        return {
          ...m,
          operations: reorderedOps,
          pattaOpsOrder: finalOrder
        };
      }
      return m;
    });

    set({ models: updatedModels });
    triggerDebouncedSave(() => {
      get().saveToDisk({ models: updatedModels });
    });
  }
});
