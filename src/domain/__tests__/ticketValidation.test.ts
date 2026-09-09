import { describe, it, expect } from 'vitest';
import { validateTicketForSubmission, getTicketPartyStatus } from '../ticketValidation';
import { ModelConfig, Worker, TicketFormState, PrintedPartyRecord, SubmittedTicketRecord } from '../../types/workbook';

describe('TicketValidation — Patta Entry and Duplicate Prevention', () => {
  const sampleModel: ModelConfig = {
    id: 'buxoro-kapalak',
    name: 'Buxoro-Kapalak',
    title: 'Model Buxoro-Kapalak',
    party: '1',
    color: 'Qora',
    size: 'XL',
    hisobSheetName: 'Buxoro-Kapalak-hisob',
    operations: [
      { id: 'op_1', name: 'Tikish', rate: 300, col: 3 }
    ],
    pattaOpsOrder: ['Tikish'],
    hisobQuantities: {}
  };

  const sampleWorkers: Worker[] = [
    { id: 1, name: 'Anvar Karimov', staj: 0, avans: 0, jarima: 0 }
  ];

  const sampleParties: PrintedPartyRecord[] = [
    {
      id: 'party_1',
      partyNumber: '10',
      modelId: 'buxoro-kapalak',
      modelName: 'Buxoro-Kapalak',
      color: 'Qora',
      pattaCount: 5,
      cumulativePattaCount: 5,
      ishSoni: 250,
      cumulativeIshSoni: 250,
      printedAt: '2026-09-09 10:00'
    }
  ];

  const submittedTickets: SubmittedTicketRecord[] = [
    {
      id: 'sub_1',
      modelId: 'buxoro-kapalak',
      partyNumber: '10',
      partyRecordId: 'party_1',
      pattaNumber: 1,
      qty: 50,
      entries: [{ opName: 'Tikish', workerId: 1 }],
      submittedAt: '10:00'
    }
  ];

  it('rejects invalid or zero quantity', () => {
    const form: TicketFormState = {
      date: '2026-09-09',
      party: '10',
      color: 'Qora',
      size: 'XL',
      patta: '2',
      qty: '0',
      entries: { Tikish: 1 }
    };

    const result = validateTicketForSubmission(form, sampleModel, sampleWorkers, sampleParties, submittedTickets);
    expect(result.isValid).toBe(false);
    expect(result.title).toContain('Ish sonini kiriting');
  });

  it('rejects when worker is not selected for any operation', () => {
    const form: TicketFormState = {
      date: '2026-09-09',
      party: '10',
      color: 'Qora',
      size: 'XL',
      patta: '2',
      qty: '50',
      entries: {}
    };

    const result = validateTicketForSubmission(form, sampleModel, sampleWorkers, sampleParties, submittedTickets);
    expect(result.isValid).toBe(false);
    expect(result.title).toContain('Ishchilar kiritilmadi');
  });

  it('prevents duplicate patta submission for the same party and patta number', () => {
    const form: TicketFormState = {
      date: '2026-09-09',
      party: '10',
      color: 'Qora',
      size: 'XL',
      patta: '1', // Already submitted in sub_1
      qty: '50',
      entries: { Tikish: 1 }
    };

    const result = validateTicketForSubmission(form, sampleModel, sampleWorkers, sampleParties, submittedTickets);
    expect(result.isValid).toBe(false);
    expect(result.title).toContain('allaqachon kiritilgan');
  });

  it('approves a valid, unsubmitted patta in the party range', () => {
    const form: TicketFormState = {
      date: '2026-09-09',
      party: '10',
      color: 'Qora',
      size: 'XL',
      patta: '2',
      qty: '50',
      entries: { Tikish: 1 }
    };

    const result = validateTicketForSubmission(form, sampleModel, sampleWorkers, sampleParties, submittedTickets);
    expect(result.isValid).toBe(true);
    expect(result.actualPattaNum).toBe(2);
    expect(result.filledEntries).toHaveLength(1);
  });

  it('getTicketPartyStatus warns when party does not exist in printed history', () => {
    const form: TicketFormState = {
      date: '2026-09-09',
      party: '99', // Not printed yet
      color: 'Qora',
      size: 'XL',
      patta: '1',
      qty: '50',
      entries: {}
    };

    const status = getTicketPartyStatus(form, sampleModel, sampleParties, submittedTickets);
    expect(status.isNonExistentParty).toBe(true);
    expect(status.hasBlockingError).toBe(true);
    expect(status.errorBannerText).toContain('hali chop etilmagan');
  });
});
