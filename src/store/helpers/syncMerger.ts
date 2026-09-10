import {
  ModelConfig,
  Worker,
  SubmittedTicketRecord,
  PrintedPartyRecord,
  PayrollPeriod
} from '../../types/workbook';
import { DEFAULT_BATCH_SIZES } from '../../constants/batchConstants';
import { sanitizePrintedPartyHistory, reconcileModelHisobQuantities } from './storeSanitizers';

export interface SyncDataPayload {
  workers?: Worker[];
  models?: ModelConfig[];
  nextPartyNumber?: number;
  printedPartyHistory?: PrintedPartyRecord[];
  submittedTickets?: SubmittedTicketRecord[];
  currentPeriod?: PayrollPeriod;
  periods?: PayrollPeriod[];
  availableSizes?: string[];
  deletedTicketIds?: string[];
  deletedPartyIds?: string[];
  deletedWorkerIds?: number[];
  deletedModelIds?: string[];
  updatedAt?: number;
  updatedBy?: string;
}

export interface MergeResult {
  workers: Worker[];
  models: ModelConfig[];
  nextPartyNumber: number;
  printedPartyHistory: PrintedPartyRecord[];
  submittedTickets: SubmittedTicketRecord[];
  currentPeriod: PayrollPeriod;
  periods: PayrollPeriod[];
  availableSizes: string[];
  deletedTicketIds: string[];
  deletedPartyIds: string[];
  deletedWorkerIds: number[];
  deletedModelIds: string[];
}

/**
 * Intelligent Conflict-Free Merger for Multi-PC Sync
 * Merges local and remote cloud data safely:
 * - Prevents zombie resurrections via Tombstones (deleted IDs)
 * - Merges workers and models at the entity/field level
 * - Automatically keeps all periods, custom sizes, and active party numbers synchronized
 */
export function mergeCloudSyncData(
  local: {
    workers?: Worker[];
    models?: ModelConfig[];
    nextPartyNumber?: number;
    printedPartyHistory?: PrintedPartyRecord[];
    submittedTickets?: SubmittedTicketRecord[];
    currentPeriod?: PayrollPeriod;
    periods?: PayrollPeriod[];
    availableSizes?: string[];
    deletedTicketIds?: string[];
    deletedPartyIds?: string[];
    deletedWorkerIds?: number[];
    deletedModelIds?: string[];
  },
  remote: SyncDataPayload
): MergeResult {
  // 1. Tombstone Sets (Union of all deletions from both PCs)
  const mergedDeletedTicketIds = Array.from(
    new Set([
      ...(local.deletedTicketIds || []),
      ...(remote.deletedTicketIds || [])
    ])
  );
  const mergedDeletedPartyIds = Array.from(
    new Set([
      ...(local.deletedPartyIds || []),
      ...(remote.deletedPartyIds || [])
    ])
  );
  const mergedDeletedWorkerIds = Array.from(
    new Set([
      ...(local.deletedWorkerIds || []),
      ...(remote.deletedWorkerIds || [])
    ])
  );
  const mergedDeletedModelIds = Array.from(
    new Set([
      ...(local.deletedModelIds || []),
      ...(remote.deletedModelIds || [])
    ])
  );

  const deletedTicketSet = new Set(mergedDeletedTicketIds);
  const deletedPartySet = new Set(mergedDeletedPartyIds);
  const deletedWorkerSet = new Set(mergedDeletedWorkerIds);
  const deletedModelSet = new Set(mergedDeletedModelIds);

  // 2. Workers (Merge by ID and Name safely, prevent runaway ID duplication)
  const workerMap = new Map<number, Worker>();
  const reindexedWorkerIdMap = new Map<number, number>(); // oldRemoteId -> canonicalId

  for (const w of local.workers || []) {
    if (w && w.id && !deletedWorkerSet.has(w.id)) {
      workerMap.set(w.id, w);
    }
  }

  const findWorkerByName = (cleanName: string): Worker | undefined => {
    if (!cleanName) return undefined;
    for (const item of workerMap.values()) {
      if ((item.name || '').trim().toLowerCase() === cleanName) {
        return item;
      }
    }
    return undefined;
  };

  for (const w of remote.workers || []) {
    if (!w || !w.id || deletedWorkerSet.has(w.id)) continue;

    const cleanRemoteName = (w.name || '').trim().toLowerCase();
    const existingById = workerMap.get(w.id);
    const existingByName = findWorkerByName(cleanRemoteName);

    if (existingByName && existingByName.id !== w.id) {
      // Agar ushbu ismli ishchi bazada allaqachon boshqa ID bilan mavjud bo'lsa, qayta yangi ID ochmaymiz!
      reindexedWorkerIdMap.set(w.id, existingByName.id);
      const remoteTime = (w as any).updatedAt || 0;
      const existingTime = (existingByName as any).updatedAt || 0;
      if (remoteTime >= existingTime) {
        workerMap.set(existingByName.id, { ...existingByName, ...w, id: existingByName.id });
      } else {
        workerMap.set(existingByName.id, { ...w, ...existingByName, id: existingByName.id });
      }
      continue;
    }

    if (!existingById) {
      workerMap.set(w.id, w);
    } else {
      const cleanExistingName = (existingById.name || '').trim().toLowerCase();

      if (cleanExistingName === cleanRemoteName || !cleanRemoteName || !cleanExistingName) {
        const remoteTime = (w as any).updatedAt || 0;
        const localTime = (existingById as any).updatedAt || 0;
        if (remoteTime >= localTime) {
          workerMap.set(w.id, { ...existingById, ...w });
        } else {
          workerMap.set(w.id, { ...w, ...existingById });
        }
      } else {
        // ID bir xil, lekin ismlar har xil (tahrirlangan holat)
        const remoteTime = (w as any).updatedAt || 0;
        const localTime = (existingById as any).updatedAt || 0;

        if (remoteTime > localTime) {
          // Masofaviy tomonda ishchining F.I.O si tahrirlangan (yangilangan)
          workerMap.set(w.id, { ...existingById, ...w });
        } else {
          // Lokal tomondagi tahrir yangiroq yoki teng
          workerMap.set(w.id, { ...w, ...existingById });
        }
      }
    }
  }

  // Xavfsizlik filtri: 200 dan katta bo'lgan takroriy (dublikat) sun'iy ID larni tozalash va reindekslash
  const seenNames = new Map<string, number>();
  for (const w of Array.from(workerMap.values()).sort((a, b) => a.id - b.id)) {
    const norm = (w.name || '').trim().toLowerCase();
    if (!norm) continue;

    if (!seenNames.has(norm)) {
      seenNames.set(norm, w.id);
    } else {
      const canonicalId = seenNames.get(norm)!;
      if (w.id >= 200 && w.id !== canonicalId) {
        workerMap.delete(w.id);
        reindexedWorkerIdMap.set(w.id, canonicalId);
        const canonical = workerMap.get(canonicalId);
        if (canonical) {
          if (w.staj && !canonical.staj) canonical.staj = w.staj;
          if (w.avans && !canonical.avans) canonical.avans = w.avans;
          if (w.jarima && !canonical.jarima) canonical.jarima = w.jarima;
          if (w.updatedAt && (!canonical.updatedAt || w.updatedAt > canonical.updatedAt)) {
            canonical.updatedAt = w.updatedAt;
          }
        }
      }
    }
  }

  const mergedWorkers = Array.from(workerMap.values()).sort((a, b) => a.id - b.id);

  // 3. Submitted Tickets (Exclude any deleted ticket; deduplicate by ID; map reindexed worker IDs)
  const ticketMap = new Map<string, SubmittedTicketRecord>();
  for (const t of local.submittedTickets || []) {
    if (t && t.id && !deletedTicketSet.has(t.id)) {
      ticketMap.set(t.id, t);
    }
  }
  for (const t of remote.submittedTickets || []) {
    if (t && t.id && !deletedTicketSet.has(t.id)) {
      let resolvedTicket = t;
      if (reindexedWorkerIdMap.size > 0 && t.entries) {
        const mappedEntries = t.entries.map((entry) => {
          if (reindexedWorkerIdMap.has(entry.workerId)) {
            return { ...entry, workerId: reindexedWorkerIdMap.get(entry.workerId)! };
          }
          return entry;
        });
        resolvedTicket = { ...t, entries: mappedEntries };
      }
      const existing = ticketMap.get(t.id);
      ticketMap.set(t.id, existing ? { ...existing, ...resolvedTicket } : resolvedTicket);
    }
  }
  const mergedSubmittedTickets = Array.from(ticketMap.values());

  // 4. Printed Party History (Exclude any deleted party; merge records)
  const partyMap = new Map<string, PrintedPartyRecord>();
  for (const p of local.printedPartyHistory || []) {
    if (p && p.id && !deletedPartySet.has(p.id)) {
      const key = `${p.modelId}_${String(p.partyNumber).trim()}`;
      partyMap.set(key, p);
    }
  }
  for (const p of remote.printedPartyHistory || []) {
    if (p && p.id && !deletedPartySet.has(p.id)) {
      const key = `${p.modelId}_${String(p.partyNumber).trim()}`;
      const existing = partyMap.get(key);
      if (existing) {
        partyMap.set(key, {
          ...existing,
          ...p,
          isClosed: Boolean(existing.isClosed || p.isClosed),
          closedAt: p.closedAt || existing.closedAt
        });
      } else {
        partyMap.set(key, p);
      }
    }
  }
  const sanitizedHistory = sanitizePrintedPartyHistory(Array.from(partyMap.values()));

  // 5. Lowest unused positive party number (considering ALL printed parties so numbers never collide or reset to 1)
  const allPartyNums = new Set(
    sanitizedHistory
      .map((h) => parseInt(String(h.partyNumber).trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
  );
  let nextUnused = 1;
  while (allPartyNums.has(nextUnused)) {
    nextUnused++;
  }
  const mergedNextPartyNumber = Math.max(
    local.nextPartyNumber || 1,
    remote.nextPartyNumber || 1,
    nextUnused
  );

  // 6. Models & Operations (Merge by ID, preserve operations and details)
  const modelMap = new Map<string, ModelConfig>();
  for (const m of local.models || []) {
    if (m && m.id && !deletedModelSet.has(m.id)) {
      modelMap.set(m.id, m);
    }
  }
  for (const m of remote.models || []) {
    if (m && m.id && !deletedModelSet.has(m.id)) {
      const existing = modelMap.get(m.id);
      if (!existing) {
        modelMap.set(m.id, m);
      } else {
        // Merge operations by normalized name
        const opMap = new Map<string, any>();
        for (const op of existing.operations || []) {
          opMap.set(op.name.toLowerCase().trim(), op);
        }
        for (const op of m.operations || []) {
          const lower = op.name.toLowerCase().trim();
          if (!opMap.has(lower)) {
            opMap.set(lower, op);
          } else {
            const curOp = opMap.get(lower);
            opMap.set(lower, {
              ...curOp,
              rate: op.rate !== undefined && op.rate > 0 ? op.rate : curOp.rate
            });
          }
        }
        const mergedOps = Array.from(opMap.values()).map((op, idx) => ({
          ...op,
          col: 3 + idx * 2,
          id: op.id || `op_${3 + idx * 2}`
        }));

        // Merge pattaOpsOrder
        const seenOrder = new Set<string>();
        const mergedOrder: string[] = [];
        for (const name of [...(existing.pattaOpsOrder || []), ...(m.pattaOpsOrder || [])]) {
          const cleanName = (name || '').trim();
          if (cleanName && !seenOrder.has(cleanName.toLowerCase())) {
            seenOrder.add(cleanName.toLowerCase());
            mergedOrder.push(cleanName);
          }
        }

        // Merge hisobQuantities (taking reindexed worker IDs into account)
        const combinedHq: Record<number, Record<string, number>> = {
          ...(existing.hisobQuantities || {})
        };
        for (const [wIdStr, ops] of Object.entries(m.hisobQuantities || {})) {
          let wId = Number(wIdStr);
          if (reindexedWorkerIdMap.has(wId)) {
            wId = reindexedWorkerIdMap.get(wId)!;
          }
          combinedHq[wId] = {
            ...(combinedHq[wId] || {}),
            ...ops
          };
        }

        modelMap.set(m.id, {
          ...existing,
          ...m,
          title: m.title || existing.title,
          color: m.color || existing.color,
          size: m.size || existing.size,
          party: m.party || existing.party,
          operations: mergedOps,
          pattaOpsOrder: mergedOrder,
          hisobQuantities: combinedHq
        });
      }
    }
  }
  let mergedModels = Array.from(modelMap.values());
  // Always reconcile hisobQuantities with current submitted tickets
  mergedModels = reconcileModelHisobQuantities(mergedModels, mergedSubmittedTickets);

  // 7. Periods & CurrentPeriod
  const periodMap = new Map<string, PayrollPeriod>();
  for (const p of local.periods || []) {
    if (p && p.id) periodMap.set(p.id, p);
  }
  for (const p of remote.periods || []) {
    if (p && p.id) {
      const existing = periodMap.get(p.id);
      periodMap.set(p.id, existing ? { ...existing, ...p } : p);
    }
  }
  const mergedPeriods = Array.from(periodMap.values());

  let mergedCurrentPeriod = local.currentPeriod || remote.currentPeriod || {
    id: 'period_default',
    name: '2026-Avgust oyligi',
    startDate: new Date().toISOString().slice(0, 7) + '-01',
    isClosed: false
  };
  if (remote.currentPeriod) {
    if (remote.currentPeriod.isClosed && !mergedCurrentPeriod.isClosed) {
      mergedCurrentPeriod = remote.currentPeriod;
    } else if (remote.currentPeriod.id !== mergedCurrentPeriod.id) {
      mergedCurrentPeriod = remote.currentPeriod;
    }
  }

  // 8. Available Sizes
  const sizeSet = new Set<string>([
    ...DEFAULT_BATCH_SIZES,
    ...(local.availableSizes || []),
    ...(remote.availableSizes || [])
  ]);
  const mergedSizes = Array.from(sizeSet);

  return {
    workers: mergedWorkers,
    models: mergedModels,
    nextPartyNumber: mergedNextPartyNumber,
    printedPartyHistory: sanitizedHistory,
    submittedTickets: mergedSubmittedTickets,
    currentPeriod: mergedCurrentPeriod,
    periods: mergedPeriods,
    availableSizes: mergedSizes,
    deletedTicketIds: mergedDeletedTicketIds,
    deletedPartyIds: mergedDeletedPartyIds,
    deletedWorkerIds: mergedDeletedWorkerIds,
    deletedModelIds: mergedDeletedModelIds
  };
}
