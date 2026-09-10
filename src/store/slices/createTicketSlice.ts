import { StateCreator } from 'zustand';
import { WorkbookStore, TicketSlice } from '../types';
import { TicketFormState, SubmittedTicketRecord } from '../../types/workbook';
import { validateTicketForSubmission } from '../../domain/ticketValidation';
import { triggerDebouncedSave } from '../helpers/debounceSave';

export const createTicketSlice: StateCreator<WorkbookStore, [], [], TicketSlice> = (set, get) => ({
  ticketForms: {},
  submittedTickets: [],

  updateTicketField: (modelId: string, field: keyof TicketFormState, value: any) => {
    const state = get();
    const currentForm = state.ticketForms[modelId] || {
      date: '',
      party: '',
      color: '',
      size: '',
      qty: '',
      entries: {}
    };
    const updatedForms = {
      ...state.ticketForms,
      [modelId]: {
        ...currentForm,
        [field]: value
      }
    };
    set({ ticketForms: updatedForms });
    triggerDebouncedSave(() => {
      get().saveToDisk({ ticketForms: updatedForms }, { skipCloudSync: true });
    });
  },

  setTicketWorker: (modelId: string, opName: string, workerId: string | number) => {
    const state = get();
    const currentForm = state.ticketForms[modelId] || {
      date: '',
      party: '',
      color: '',
      size: '',
      qty: '',
      entries: {}
    };
    const updatedEntries = {
      ...(currentForm.entries || {}),
      [opName]: workerId
    };
    const updatedForms = {
      ...state.ticketForms,
      [modelId]: {
        ...currentForm,
        entries: updatedEntries
      }
    };
    set({ ticketForms: updatedForms });
    triggerDebouncedSave(() => {
      get().saveToDisk({ ticketForms: updatedForms }, { skipCloudSync: true });
    });
  },

  clearTicketForm: (modelId: string) => {
    const state = get();
    const currentForm = state.ticketForms[modelId];
    if (!currentForm) return;
    const updatedForms = {
      ...state.ticketForms,
      [modelId]: {
        ...currentForm,
        qty: '',
        entries: {}
      }
    };
    set({ ticketForms: updatedForms });
    triggerDebouncedSave(() => {
      get().saveToDisk({ ticketForms: updatedForms }, { skipCloudSync: true });
    });
  },

  jonatish: async (modelId: string): Promise<boolean> => {
    const state = get();
    const model = state.models.find((m) => m.id === modelId || m.name === modelId);
    if (!model) {
      state.addNotification('error', 'Xatolik', `Model topilmadi: ${modelId}`);
      return false;
    }

    const form = state.ticketForms[model.id] || state.ticketForms[model.name];
    if (!form) {
      state.addNotification('error', 'Xatolik', 'Patta formasi topilmadi');
      return false;
    }

    const requireTicketValidation = state.licenseStatus?.requireTicketValidation !== false;
    const validation = validateTicketForSubmission(
      form,
      model,
      state.workers,
      state.printedPartyHistory,
      state.submittedTickets,
      { requireTicketValidation }
    );

    if (!validation.isValid) {
      state.addNotification(
        validation.errorType || 'error',
        validation.title || 'Xatolik',
        validation.message || 'Xatolik yuz berdi'
      );
      return false;
    }

    const filledEntries = validation.filledEntries!;
    const actualPattaNum = validation.actualPattaNum!;
    const qty = Number(form.qty);
    const currentPartyStr = String(form.party || '1');
    const currentPattaNum = parseInt(form.patta || '1', 10) || 1;

    // Apply additions to hisobQuantities
    const updatedHisobQuantities = { ...(model.hisobQuantities || {}) };

    for (const entry of filledEntries) {
      const currentWorkerOps = { ...(updatedHisobQuantities[entry.workerId] || {}) };
      const currentQty = currentWorkerOps[entry.opName] || 0;
      currentWorkerOps[entry.opName] = currentQty + qty;
      updatedHisobQuantities[entry.workerId] = currentWorkerOps;
    }

    const updatedModels = state.models.map((m) => {
      if (m.id === modelId) {
        return {
          ...m,
          hisobQuantities: updatedHisobQuantities
        };
      }
      return m;
    });

    const submittedRecord: SubmittedTicketRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      modelId,
      partyNumber: currentPartyStr,
      partyRecordId: validation.partyOwner?.id,
      isClosed: false,
      konveyer: form.konveyer || '',
      pattaNumber: actualPattaNum,
      size: form.size || '',
      color: form.color || '',
      qty,
      entries: filledEntries,
      submittedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };
    const updatedSubmittedTickets = [...(state.submittedTickets || []), submittedRecord];

    // Check if current party reached its max printed pattas
    const matchingPrintedParty = (state.printedPartyHistory || []).find(
      (h) => !h.isClosed && h.modelId === modelId && String(h.partyNumber) === currentPartyStr
    ) || validation.partyOwner;
    const maxPattasInParty = matchingPrintedParty ? matchingPrintedParty.pattaCount : 0;

    let nextPartyStr = currentPartyStr;
    let nextPattaNum = currentPattaNum + 1;

    if (maxPattasInParty > 0 && currentPattaNum >= maxPattasInParty) {
      // Find subsequent printed parties for this model if any
      const modelPrintedParties = (state.printedPartyHistory || [])
        .filter((h) => h.modelId === modelId)
        .map((h) => parseInt(h.partyNumber, 10))
        .filter((num) => !isNaN(num))
        .sort((a, b) => a - b);

      const currentPartyInt = parseInt(currentPartyStr, 10);
      const nextPrinted = modelPrintedParties.find((p) => p > currentPartyInt);

      if (nextPrinted !== undefined) {
        nextPartyStr = String(nextPrinted);
      } else if (!isNaN(currentPartyInt)) {
        nextPartyStr = String(currentPartyInt + 1);
      }
      nextPattaNum = 1;
    }

    const updatedForms = {
      ...state.ticketForms,
      [modelId]: {
        ...form,
        party: nextPartyStr,
        patta: String(nextPattaNum),
        qty: '',
        entries: {}
      }
    };

    set({
      models: updatedModels,
      ticketForms: updatedForms,
      submittedTickets: updatedSubmittedTickets
    });

    // Save to disk & database + update Excel
    await get().saveToDisk(
      {
        models: updatedModels,
        ticketForms: updatedForms,
        submittedTickets: updatedSubmittedTickets
      },
      { forceBackup: true }
    );

    // Log transaction to audit file
    try {
      fetch('/api/log-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, qty, entries: filledEntries })
      });
    } catch (e) {
      console.warn(e);
    }

    state.addNotification(
      'success',
      'Muvaffaqiyatli saqlandi',
      "Ma'lumotlar hisob-kitobga va diskdagi bazaga doimiy saqlandi!"
    );
    return true;
  },

  deleteSubmittedTicket: async (ticketId: string) => {
    const state = get();
    const ticket = (state.submittedTickets || []).find((s) => s.id === ticketId);
    if (!ticket) return;

    // Revert quantities in model
    const model = state.models.find((m) => m.id === ticket.modelId);
    let updatedModels = state.models;

    if (model && ticket.entries && ticket.entries.length > 0) {
      const updatedHisobQuantities = { ...(model.hisobQuantities || {}) };
      for (const entry of ticket.entries) {
        if (updatedHisobQuantities[entry.workerId]) {
          const currentOps = { ...updatedHisobQuantities[entry.workerId] };
          if (currentOps[entry.opName] !== undefined) {
            currentOps[entry.opName] = Math.max(0, currentOps[entry.opName] - ticket.qty);
            updatedHisobQuantities[entry.workerId] = currentOps;
          }
        }
      }

      updatedModels = state.models.map((m) => {
        if (m.id === ticket.modelId) {
          return {
            ...m,
            hisobQuantities: updatedHisobQuantities
          };
        }
        return m;
      });
    }

    const updatedSubmittedTickets = (state.submittedTickets || []).filter((s) => s.id !== ticketId);
    const updatedDeletedTicketIds = Array.from(new Set([...(state.deletedTicketIds || []), ticketId]));

    set({
      models: updatedModels,
      submittedTickets: updatedSubmittedTickets,
      deletedTicketIds: updatedDeletedTicketIds
    });

    await get().saveToDisk({
      models: updatedModels,
      submittedTickets: updatedSubmittedTickets,
      deletedTicketIds: updatedDeletedTicketIds
    });

    state.addNotification(
      'success',
      'Patta bekor qilindi',
      `Partiya ${ticket.partyNumber}, Patta ${ticket.pattaNumber} (${ticket.qty} dona) hisobdan qaytarildi va o'chirildi.`
    );
  }
});
