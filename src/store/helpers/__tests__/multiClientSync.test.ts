import { describe, it, expect } from 'vitest';
import { mergeCloudSyncData, SyncDataPayload } from '../syncMerger';
import { SubmittedTicketRecord, PrintedPartyRecord, ModelConfig, PayrollPeriod } from '../../../types/workbook';

describe('Multi-Client Concurrency and Conflict-Free Merge', () => {
  const defaultPeriod: PayrollPeriod = {
    id: 'period_default',
    name: '2026-Sentyabr oyligi',
    startDate: '2026-09-01',
    isClosed: false
  };

  it('merges concurrent ticket submissions from two PCs without losing tickets', () => {
    // PC-A submitted Ticket #1
    const local = {
      submittedTickets: [
        {
          id: 'ticket_pcA_1',
          modelId: 'model_kofta',
          partyNumber: '1',
          pattaNumber: 1,
          qty: 50,
          entries: [{ opName: 'Bichish', workerId: 1, workerNameSnapshot: 'Ali', rateSnapshot: 500 }],
          submittedAt: '10:00'
        } as SubmittedTicketRecord
      ],
      currentPeriod: defaultPeriod
    };

    // PC-B submitted Ticket #2 concurrently
    const remote: SyncDataPayload = {
      submittedTickets: [
        {
          id: 'ticket_pcB_2',
          modelId: 'model_kofta',
          partyNumber: '1',
          pattaNumber: 2,
          qty: 50,
          entries: [{ opName: 'Bichish', workerId: 2, workerNameSnapshot: 'Vali', rateSnapshot: 500 }],
          submittedAt: '10:05'
        } as SubmittedTicketRecord
      ]
    };

    const merged = mergeCloudSyncData(local, remote);

    expect(merged.submittedTickets.length).toBe(2);
    expect(merged.submittedTickets.some((t) => t.id === 'ticket_pcA_1')).toBe(true);
    expect(merged.submittedTickets.some((t) => t.id === 'ticket_pcB_2')).toBe(true);

    // Verify snapshot fields are preserved
    const ticketA = merged.submittedTickets.find((t) => t.id === 'ticket_pcA_1');
    expect(ticketA?.entries?.[0].workerNameSnapshot).toBe('Ali');
    expect(ticketA?.entries?.[0].rateSnapshot).toBe(500);
  });

  it('prevents deleted printed party resurrection using business key tombstone modelId#partyNumber', () => {
    const local = {
      printedPartyHistory: [] as PrintedPartyRecord[],
      deletedPartyIds: ['model_k#3'], // Tombstone business key
      currentPeriod: defaultPeriod
    };

    // Remote PC has a party record with same business key but potentially different ID
    const remote: SyncDataPayload = {
      printedPartyHistory: [
        {
          id: 'party_rec_xyz',
          modelId: 'model_k',
          partyNumber: '3',
          modelName: 'Kofta',
          color: 'Qora',
          pattaCount: 10,
          cumulativePattaCount: 10,
          ishSoni: 500,
          cumulativeIshSoni: 500,
          printedAt: '2026-09-17'
        } as PrintedPartyRecord
      ],
      deletedPartyIds: []
    };

    const merged = mergeCloudSyncData(local, remote);

    // Party 3 for model_k must be suppressed by the business key tombstone!
    expect(merged.printedPartyHistory.length).toBe(0);
    expect(merged.deletedPartyIds).toContain('model_k#3');
  });

  it('tombstones old model ID when renamed on one PC so it does not duplicate on second PC', () => {
    // PC-A renamed model from "Kofta" to "Bluzka", so "Kofta" is tombstoned
    const remote: SyncDataPayload = {
      models: [
        {
          id: 'Bluzka',
          name: 'Bluzka',
          hisobSheetName: 'Bluzka-hisob',
          title: 'Модел- Bluzka',
          party: '1',
          color: 'Oq',
          size: 'M',
          operations: [{ id: 'op_1', name: 'Tikish', rate: 1000 }],
          pattaOpsOrder: ['Tikish'],
          hisobQuantities: {}
        } as ModelConfig
      ],
      deletedModelIds: ['Kofta'] // PC-A tombstoned Kofta
    };

    // PC-B still has "Kofta" in local models
    const local = {
      models: [
        {
          id: 'Kofta',
          name: 'Kofta',
          hisobSheetName: 'Kofta-hisob',
          title: 'Модел- Kofta',
          party: '1',
          color: 'Qora',
          size: 'M',
          operations: [{ id: 'op_1', name: 'Tikish', rate: 1000 }],
          pattaOpsOrder: ['Tikish'],
          hisobQuantities: {}
        } as ModelConfig
      ],
      deletedModelIds: [],
      currentPeriod: defaultPeriod
    };

    const merged = mergeCloudSyncData(local, remote);

    // Must NOT have "Kofta" anymore, only "Bluzka"!
    expect(merged.models.some((m) => m.id === 'Kofta')).toBe(false);
    expect(merged.models.some((m) => m.id === 'Bluzka')).toBe(true);
    expect(merged.models.length).toBe(1);
    expect(merged.deletedModelIds).toContain('Kofta');
  });
});
