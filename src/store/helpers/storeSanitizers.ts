import { Worker, ModelConfig, TicketFormState, ModelPattaBatchConfig, SubmittedTicketRecord } from '../../types/workbook';
import { DEFAULT_BATCH_SIZES } from '../../constants/batchConstants';
import { formatDateIso } from '../../utils/formatters';

export function createInitialPattaBatchConfigs(
  models: ModelConfig[],
  sizesList: readonly string[] = DEFAULT_BATCH_SIZES
): Record<string, ModelPattaBatchConfig> {
  const configs: Record<string, ModelPattaBatchConfig> = {};
  for (const m of models) {
    const sizesObj: Record<string, string> = {};
    for (const s of sizesList) {
      sizesObj[s] = '';
    }
    configs[m.id] = {
      partyNumber: '',
      isCustomParty: false,
      totalIshSoni: '',
      color: m.color || 'Кора',
      sizes: sizesObj
    };
  }
  return configs;
}

export function createInitialTicketForms(models: ModelConfig[]): Record<string, TicketFormState> {
  const forms: Record<string, TicketFormState> = {};
  const today = formatDateIso();
  for (const m of models) {
    let cleanParty = m.party || '';
    if (cleanParty.includes('6632') || cleanParty.includes('Мато Партия')) {
      cleanParty = '';
    }
    forms[m.id] = {
      date: today,
      party: cleanParty,
      color: m.color || 'Кора',
      size: m.size || 'XL',
      qty: '',
      patta: '',
      entries: {}
    };
  }
  return forms;
}

export function sanitizeWorkers(wList: any[]): Worker[] {
  if (!Array.isArray(wList)) return [];
  return wList.map((w: any) => ({
    ...w,
    avans: Math.max(0, Number(w.avans) || 0),
    jarima: Math.max(0, Number(w.jarima) || 0),
    staj: Math.max(0, Number(w.staj) || 0)
  }));
}

export function sanitizeModels(mList: any[]): ModelConfig[] {
  if (!Array.isArray(mList)) return [];
  return mList.map((m: any) => {
    let fixedTitle = m.title || m.name;
    if (m.id === 'Buxoro-Kapalak-long') {
      fixedTitle = 'Модел- Бухоро Капалак лонг';
    } else if (m.id === 'Buxoro-Kapalak') {
      fixedTitle = 'Модел- Бухоро Капалак';
    } else if (m.id === 'Dana-Polo') {
      fixedTitle = 'Модел- Дана Polo';
    } else if (m.id === 'Dana-Polo-long') {
      fixedTitle = 'Модел- Дана Polo лонг';
    }

    let cleanParty = m.party || '';
    if (cleanParty.includes('6632') || cleanParty.includes('Мато Партия')) {
      cleanParty = '';
    }

    // 1. Deduplicate operations (keep unique names)
    const uniqueOps: any[] = [];
    const seenOps = new Set<string>();
    for (const o of (m.operations || [])) {
      const name = (o.name || '').trim();
      if (name && !seenOps.has(name.toLowerCase())) {
        seenOps.add(name.toLowerCase());
        uniqueOps.push({ ...o, name });
      }
    }
    for (let i = 0; i < uniqueOps.length; i++) {
      uniqueOps[i].col = 3 + i * 2;
      uniqueOps[i].id = `op_${uniqueOps[i].col}`;
    }

    // 2. Deduplicate pattaOpsOrder (keep unique names in sync with uniqueOps)
    const seenPatta = new Set<string>();
    const uniquePattaOps: string[] = [];
    for (const p of (m.pattaOpsOrder || [])) {
      const pClean = (p || '').trim();
      if (pClean && seenOps.has(pClean.toLowerCase()) && !seenPatta.has(pClean.toLowerCase())) {
        seenPatta.add(pClean.toLowerCase());
        uniquePattaOps.push(pClean);
      }
    }
    for (const o of uniqueOps) {
      if (!seenPatta.has(o.name.toLowerCase())) {
        seenPatta.add(o.name.toLowerCase());
        uniquePattaOps.push(o.name);
      }
    }

    return {
      ...m,
      title: fixedTitle,
      party: cleanParty,
      operations: uniqueOps,
      pattaOpsOrder: uniquePattaOps,
      hisobQuantities: m.hisobQuantities && typeof m.hisobQuantities === 'object' ? m.hisobQuantities : {}
    };
  });
}

export function sanitizeForms(forms: any, modelsList: ModelConfig[]): Record<string, TicketFormState> {
  const initial = createInitialTicketForms(modelsList);
  if (!forms) return initial;
  const cleanForms: Record<string, TicketFormState> = {};
  for (const m of modelsList) {
    const f = forms[m.id] || initial[m.id] || {
      date: formatDateIso(),
      party: '',
      color: m.color || 'Кора',
      size: m.size || 'XL',
      qty: '',
      patta: '',
      entries: {}
    };
    let cleanParty = f.party || '';
    if (cleanParty.includes('6632') || cleanParty.includes('Мато Партия')) {
      cleanParty = '';
    }
    cleanForms[m.id] = {
      date: f.date || formatDateIso(),
      party: cleanParty,
      color: f.color || m.color || 'Кора',
      size: f.size || m.size || 'XL',
      qty: f.qty !== undefined ? String(f.qty) : '',
      patta: f.patta !== undefined ? String(f.patta) : '',
      entries: (f.entries && typeof f.entries === 'object') ? { ...f.entries } : {}
    };
  }
  return cleanForms;
}

export function sanitizePattaBatchConfigs(
  configs: any,
  modelsList: ModelConfig[],
  sizesListOrParty?: any,
  maybeSizesList?: readonly string[]
): Record<string, ModelPattaBatchConfig> {
  const sizesList: readonly string[] = Array.isArray(sizesListOrParty)
    ? sizesListOrParty
    : Array.isArray(maybeSizesList)
    ? maybeSizesList
    : DEFAULT_BATCH_SIZES;
  const initial = createInitialPattaBatchConfigs(modelsList, sizesList);
  if (!configs) return initial;

  const cleanConfigs: Record<string, ModelPattaBatchConfig> = {};
  for (const m of modelsList) {
    const c = configs[m.id];
    const sizesObj: Record<string, string> = {};
    for (const s of sizesList) {
      sizesObj[s] = (c && c.sizes && c.sizes[s] !== undefined) ? String(c.sizes[s]) : '';
    }
    if (c && c.sizes) {
      for (const [szKey, szVal] of Object.entries(c.sizes)) {
        if (sizesObj[szKey] === undefined) {
          sizesObj[szKey] = String(szVal || '');
        }
      }
    }

    const isCustom = Boolean(c && c.isCustomParty && c.partyNumber && String(c.partyNumber).trim() !== '');
    const pNum = isCustom ? String(c.partyNumber).trim() : '';

    cleanConfigs[m.id] = {
      partyNumber: pNum,
      isCustomParty: isCustom,
      totalIshSoni: (c && c.totalIshSoni !== undefined) ? String(c.totalIshSoni) : '',
      color: (c && c.color) || m.color || 'Кора',
      sizes: sizesObj
    };
  }
  return cleanConfigs;
}

export function sanitizePrintedPartyHistory(history: any[]): any[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  const map = new Map<string, any>();
  for (const r of history) {
    if (!r || !r.modelId) continue;
    const key = `${r.modelId}_${String(r.partyNumber).trim()}`;
    // Agar bir xil model va bir xil partiya raqami bo'lsa, oxirgi yangi yozuvni saqlaymiz (dublikatni yo'qotamiz)
    map.set(key, r);
  }
  let cumPattas = 0;
  let cumIshs = 0;
  return Array.from(map.values()).map((r) => {
    cumPattas += Number(r.pattaCount) || 0;
    cumIshs += Number(r.totalIshSoni || r.ishSoni) || 0;
    const cleanR: any = {
      ...r,
      cumulativePattaCount: cumPattas,
      cumulativeIshSoni: cumIshs
    };
    if (cleanR.closedAt === undefined) {
      delete cleanR.closedAt;
    }
    return cleanR;
  });
}

/**
 * submittedTickets dagi barcha topshirilgan pattalardan hisobQuantities ni qayta tiklash/reconciliation qilish.
 * Agar model.hisobQuantities bo'sh bo'lib qolsa yoki submittedTickets dan kam bo'lsa,
 * ushbu funksiya model.hisobQuantities ni submittedTickets dagi haqiqiy ishlar bilan to'ldiradi.
 */
export function reconcileModelHisobQuantities(
  models: ModelConfig[],
  submittedTickets: SubmittedTicketRecord[]
): ModelConfig[] {
  if (!models || models.length === 0) return models || [];
  if (!submittedTickets || submittedTickets.length === 0) return models;

  // 1. submittedTickets bo'yicha har bir model, ishchi va operatsiya bo'yicha jami sonlarni hisoblaymiz
  const ticketTotalsByModel: Record<string, Record<number, Record<string, number>>> = {};

  for (const t of submittedTickets) {
    if (!t.modelId || !t.entries || t.entries.length === 0) continue;
    const mId = t.modelId;
    if (!ticketTotalsByModel[mId]) {
      ticketTotalsByModel[mId] = {};
    }
    const mHq = ticketTotalsByModel[mId];
    const qty = Number(t.qty) || 0;
    if (qty <= 0) continue;

    for (const e of t.entries) {
      if (e.workerId === undefined || e.workerId === null || !e.opName) continue;
      if (!mHq[e.workerId]) {
        mHq[e.workerId] = {};
      }
      mHq[e.workerId][e.opName] = (mHq[e.workerId][e.opName] || 0) + qty;
    }
  }

  // 2. Har bir modelga tekshirib qo'llaymiz
  return models.map((m) => {
    const computedHq = ticketTotalsByModel[m.id];
    if (!computedHq) return m;

    const existingHq = { ...(m.hisobQuantities || {}) };
    let changed = false;

    // Har bir ishchining hisobQuantities ni tekshiramiz
    for (const [wIdStr, ops] of Object.entries(computedHq)) {
      const wId = Number(wIdStr);
      if (!existingHq[wId]) {
        existingHq[wId] = { ...ops };
        changed = true;
      } else {
        const currentWorkerOps = { ...existingHq[wId] };
        for (const [opName, compQty] of Object.entries(ops)) {
          const curQty = currentWorkerOps[opName] || 0;
          // Agar bazadagi hisobQuantities pattalardan farq qilsa (qo'shilgan yoki o'chirilgan bo'lsa),
          // haqiqiy tasdiqlangan pattalar soniga tenglashtiramiz
          if (curQty !== compQty) {
            currentWorkerOps[opName] = compQty;
            changed = true;
          }
        }
        existingHq[wId] = currentWorkerOps;
      }
    }

    if (changed) {
      return {
        ...m,
        hisobQuantities: existingHq
      };
    }
    return m;
  });
}

