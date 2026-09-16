import { describe, it, expect } from 'vitest';
import { mergeCloudSyncData, SyncDataPayload } from '../syncMerger';
import { Worker, SubmittedTicketRecord, PrintedPartyRecord, PayrollPeriod } from '../../../types/workbook';

describe('SyncMerger — Offline Multi-PC Conflict-Free Merger', () => {
  const defaultPeriod: PayrollPeriod = {
    id: 'period_default',
    name: '2026-Sentyabr oyligi',
    startDate: '2026-09-01',
    isClosed: false
  };

  it('respects Tombstones and never resurrects deleted workers', () => {
    const local = {
      workers: [{ id: 1, name: 'Ali' }, { id: 2, name: 'Vali' }] as Worker[],
      deletedWorkerIds: [2], // Worker 2 was deleted locally
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      workers: [{ id: 1, name: 'Ali' }, { id: 2, name: 'Vali' }] as Worker[], // Remote still had Worker 2
      deletedWorkerIds: []
    };

    const result = mergeCloudSyncData(local, remote);

    // Worker 2 must NOT be in the merged workers list
    expect(result.workers.some((w) => w.id === 2)).toBe(false);
    expect(result.workers.some((w) => w.id === 1)).toBe(true);
    expect(result.deletedWorkerIds).toContain(2);
  });

  it('respects Tombstones and never resurrects deleted tickets', () => {
    const local = {
      submittedTickets: [
        { id: 'sub_1', modelId: 'm1', pattaNumber: 1 } as SubmittedTicketRecord
      ],
      deletedTicketIds: ['sub_2'],
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      submittedTickets: [
        { id: 'sub_1', modelId: 'm1', pattaNumber: 1 } as SubmittedTicketRecord,
        { id: 'sub_2', modelId: 'm1', pattaNumber: 2 } as SubmittedTicketRecord // Deleted ticket on remote
      ],
      deletedTicketIds: []
    };

    const result = mergeCloudSyncData(local, remote);

    expect(result.submittedTickets.some((t) => t.id === 'sub_2')).toBe(false);
    expect(result.submittedTickets.some((t) => t.id === 'sub_1')).toBe(true);
    expect(result.deletedTicketIds).toContain('sub_2');
  });

  it('merges new workers and updates their advances/penalties correctly', () => {
    const local = {
      workers: [
        { id: 1, name: 'Ali', avans: 10000, jarima: 0, staj: 0 } as Worker
      ],
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      workers: [
        { id: 1, name: 'Ali', avans: 10000, jarima: 5000, staj: 20000 } as Worker, // Remote updated jarima & staj
        { id: 2, name: 'Gani', avans: 0, jarima: 0, staj: 0 } as Worker           // Remote added Gani
      ]
    };

    const result = mergeCloudSyncData(local, remote);

    expect(result.workers).toHaveLength(2);
    const ali = result.workers.find((w) => w.id === 1);
    expect(ali).toBeDefined();
    expect(ali?.jarima).toBe(5000);
    expect(ali?.staj).toBe(20000);

    const gani = result.workers.find((w) => w.id === 2);
    expect(gani).toBeDefined();
    expect(gani?.name).toBe('Gani');
  });

  it('merges printed party history without duplicating records', () => {
    const party1: PrintedPartyRecord = {
      id: 'party_10',
      partyNumber: '10',
      modelId: 'm1',
      modelName: 'Model 1',
      color: 'Qora',
      pattaCount: 5,
      cumulativePattaCount: 5,
      ishSoni: 100,
      cumulativeIshSoni: 100,
      printedAt: '2026-09-09 10:00'
    };

    const party2: PrintedPartyRecord = {
      id: 'party_11',
      partyNumber: '11',
      modelId: 'm1',
      modelName: 'Model 1',
      color: 'Qora',
      pattaCount: 4,
      cumulativePattaCount: 9,
      ishSoni: 80,
      cumulativeIshSoni: 180,
      printedAt: '2026-09-09 11:00'
    };

    const local = {
      printedPartyHistory: [party1],
      nextPartyNumber: 11,
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      printedPartyHistory: [party1, party2],
      nextPartyNumber: 12
    };

    const result = mergeCloudSyncData(local, remote);

    expect(result.printedPartyHistory).toHaveLength(2);
    expect(result.nextPartyNumber).toBe(12);
  });

  it('preserves worker #200 and their tickets accurately when remote sends worker #200', () => {
    const local = {
      workers: [
        { id: 198, name: 'МУМИНА ОПА' },
        { id: 199, name: 'Абдумуталова Шахноза' }
      ] as Worker[],
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      workers: [
        { id: 198, name: 'МУМИНА ОПА' },
        { id: 199, name: 'Абдумуталова Шахноза' },
        { id: 200, name: 'Янги ишчи 200' }
      ] as Worker[],
      submittedTickets: [
        {
          id: 'sub_test_200',
          modelId: 'm1',
          pattaNumber: 1,
          entries: [{ opName: 'Op1', workerId: 200 }]
        } as unknown as SubmittedTicketRecord
      ]
    };

    const result = mergeCloudSyncData(local, remote);

    // Worker 200 must NOT disappear
    expect(result.workers).toHaveLength(3);
    expect(result.workers.map((w) => w.id)).toEqual([198, 199, 200]);
    expect(result.workers.find((w) => w.id === 200)?.name).toBe('Янги ишчи 200');

    // Ticket pointing to worker 200 must stay 200
    expect(result.submittedTickets[0]?.entries?.[0]?.workerId).toBe(200);
  });

  it('updates worker name when updated remotely with newer timestamp (e.g. replacement of worker #210)', () => {
    const local = {
      workers: [
        { id: 210, name: 'Эски ишчи', updatedAt: 1000 }
      ] as Worker[],
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      workers: [
        { id: 210, name: 'Янги алмаштирилган ишчи', updatedAt: 2000 }
      ] as Worker[]
    };

    const result = mergeCloudSyncData(local, remote);

    expect(result.workers).toHaveLength(1);
    expect(result.workers[0].id).toBe(210);
    expect(result.workers[0].name).toBe('Янги алмаштирилган ишчи');
  });

  it('retains local worker name if local has newer timestamp than remote', () => {
    const local = {
      workers: [
        { id: 210, name: 'Маҳаллий янги ном', updatedAt: 3000 }
      ] as Worker[],
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      workers: [
        { id: 210, name: 'Эски булут номи', updatedAt: 1000 }
      ] as Worker[]
    };

    const result = mergeCloudSyncData(local, remote);

    expect(result.workers).toHaveLength(1);
    expect(result.workers[0].id).toBe(210);
    expect(result.workers[0].name).toBe('Маҳаллий янги ном');
  });

  it('protects active models existing on both sides from stale deletedModelIds', () => {
    const local = {
      models: [
        { id: 'Buxoro-slim', name: 'Buxoro-slim', operations: [], pattaOpsOrder: [] }
      ] as any[],
      deletedModelIds: [],
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      models: [
        { id: 'Buxoro-slim', name: 'Buxoro-slim', operations: [], pattaOpsOrder: [] }
      ] as any[],
      deletedModelIds: ['Buxoro-slim'] // Stale remote tombstone
    };

    const result = mergeCloudSyncData(local, remote);

    // Buxoro-slim must NOT be deleted because it is active on both sides
    expect(result.models.some((m) => m.id === 'Buxoro-slim')).toBe(true);
    expect(result.deletedModelIds).not.toContain('Buxoro-slim');
  });

  it('strips legacy synthetic 200..400 tombstones and allows worker 200 to be added', () => {
    const syntheticTombstones = Array.from({ length: 201 }, (_, i) => 200 + i); // 200 to 400
    const local = {
      workers: [{ id: 200, name: 'Янги ишчи 200' }] as Worker[],
      deletedWorkerIds: syntheticTombstones,
      currentPeriod: defaultPeriod
    };

    const remote: SyncDataPayload = {
      workers: [],
      deletedWorkerIds: syntheticTombstones
    };

    const result = mergeCloudSyncData(local, remote);
    expect(result.workers.some((w) => w.id === 200)).toBe(true);
    expect(result.deletedWorkerIds).not.toContain(200);
  });
});
