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

export function cleanWorkerName(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\ufffd\uFFFD?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeWorkerName(raw: string): string {
  if (!raw) return '';
  return cleanWorkerName(raw)
    .toLowerCase()
    .replace(/xon$|хон$|opa$|опа$|aka$|ака$|bonu$|бону$|oy$|ой$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const CANONICAL_WORKER_ALIASES: Record<string, number> = {
  // 189: Тожикулова Гулнозахон was renamed to Ахмедова Фотима
  'тожикулова гулноза': 189,
  'тожикулова гулнозахон': 189,
  'тожикулова': 189,
  'ахмедова фотима': 189,
  // 186: Акбарова Манзура
  'акбарова манзура': 186,
  // 198: МУМИНА ОПА
  'мумина опа': 198,
  'мумина': 198,
  // 68: Умаркулова Мухаббат
  'умаркулова мухаббат': 68,
  'ураимова мухаббат': 68,
  'умаркулова': 68,
  // 12: АХМАДЖОНОВА МУХАЙЁ
  'ахмаджонова мухайё': 12,
  'ахмаджонов мухайё': 12,
  'ахмаджонова': 12,
  // 112: УРАИМОВА МУНОЖАТХОН
  'ураимова муножатхон': 112,
  'ураимова муножат': 112,
  // 71: ОДИЛОВА МАХЛИЁ
  'одилова махлиё': 71,
  // 53: МАМАЖОНОВА
  'мамажанова гулбохор': 53
};

export const LEGACY_WORKER_ID_MAP: Record<number, number> = {
  200: 112,
  201: 68,
  202: 189,
  295: 189,
  303: 12,
  392: 71,
  401: 68,
  402: 189,
  403: 198,
  404: 112,
  405: 189,
  406: 198,
  407: 68,
  408: 112,
  409: 68,
  447: 12
};

export function sanitizeWorkers(wList: any[]): Worker[] {
  if (!Array.isArray(wList)) return [];

  const workerMap = new Map<number, Worker>();
  const sorted = [...wList].filter((w) => w && w.id).sort((a, b) => a.id - b.id);

  // 1. First pass: Register base workers (id <= 199)
  for (const w of sorted) {
    if (w.id <= 199) {
      const cleanName = cleanWorkerName(w.name || '');
      workerMap.set(w.id, {
        ...w,
        id: w.id,
        name: cleanName || w.name,
        avans: Math.max(0, Number(w.avans) || 0),
        jarima: Math.max(0, Number(w.jarima) || 0),
        staj: Math.max(0, Number(w.staj) || 0)
      });
    }
  }

  // 2. Build index of normalized names of base workers
  const baseNameMap = new Map<string, number>();
  for (const w of workerMap.values()) {
    const norm = normalizeWorkerName(w.name);
    if (norm) baseNameMap.set(norm, w.id);
  }

  // 3. Second pass: Check workers with id > 199
  for (const w of sorted) {
    if (w.id <= 199) continue;

    const rawName = cleanWorkerName(w.name || '');
    const norm = normalizeWorkerName(rawName);

    // 1. Check if mapped by alias
    let targetCanonicalId: number | undefined = CANONICAL_WORKER_ALIASES[norm];

    // 2. Check if matches any base worker by normalized name
    if (!targetCanonicalId && baseNameMap.has(norm)) {
      targetCanonicalId = baseNameMap.get(norm);
    }

    // 3. Check if mapped by legacy ID
    if (!targetCanonicalId && LEGACY_WORKER_ID_MAP[w.id] && workerMap.has(LEGACY_WORKER_ID_MAP[w.id])) {
      targetCanonicalId = LEGACY_WORKER_ID_MAP[w.id];
    }

    if (targetCanonicalId && workerMap.has(targetCanonicalId)) {
      // Merge staj/avans/jarima into canonical worker
      const canonical = workerMap.get(targetCanonicalId)!;
      if (w.staj && (!canonical.staj || w.staj > canonical.staj)) canonical.staj = w.staj;
      if (w.avans && (!canonical.avans || w.avans > canonical.avans)) canonical.avans = w.avans;
      if (w.jarima && (!canonical.jarima || w.jarima > canonical.jarima)) canonical.jarima = w.jarima;
      continue; // Merged! Do NOT keep duplicate
    }

    // If ID is an absurd jump (e.g. w.id > 250 or gap > 1 from current sequential max),
    // it is a phantom duplicate from runaway sync, discard it!
    const currentMaxId = Array.from(workerMap.keys()).reduce((max, id) => Math.max(max, id), 0);
    if (w.id > 199 && (w.id > currentMaxId + 1 || w.id >= 250)) {
      continue; // Discard phantom runaway ID
    }

    // Truly new sequentially added worker (e.g. #200, #201)
    workerMap.set(w.id, {
      ...w,
      id: w.id,
      name: rawName,
      avans: Math.max(0, Number(w.avans) || 0),
      jarima: Math.max(0, Number(w.jarima) || 0),
      staj: Math.max(0, Number(w.staj) || 0)
    });
  }

  return Array.from(workerMap.values()).sort((a, b) => a.id - b.id);
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
const LEGACY_PHANTOM_MAP: Record<number, number> = {
  200: 112,
  201: 68,
  295: 189,
  303: 12,
  392: 71
};

export function reconcileModelHisobQuantities(
  models: ModelConfig[],
  submittedTickets: SubmittedTicketRecord[]
): ModelConfig[] {
  if (!models || models.length === 0) return models || [];
  const safeTickets = submittedTickets || [];

  // 1. submittedTickets bo'yicha har bir model, ishchi va operatsiya bo'yicha jami sonlarni hisoblaymiz
  const ticketTotalsByModel: Record<string, Record<number, Record<string, number>>> = {};

  for (const t of safeTickets) {
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
      const targetWorkerId = e.workerId >= 200
        ? (LEGACY_PHANTOM_MAP[e.workerId] || 68)
        : e.workerId;

      if (!mHq[targetWorkerId]) {
        mHq[targetWorkerId] = {};
      }
      mHq[targetWorkerId][e.opName] = (mHq[targetWorkerId][e.opName] || 0) + qty;
    }
  }

  // 2. Har bir modelga tekshirib qo'llaymiz va 200+ ID larni tozalab, asosiy ishchilarga birlashtiramiz
  return models.map((m) => {
    const computedHq = ticketTotalsByModel[m.id];
    const existingHq = { ...(m.hisobQuantities || {}) };
    let changed = false;

    // 200 dan katta bo'lgan barcha sun'iy dublikat kalitlarni olib tashlash va birlashtirish
    for (const [wIdStr, ops] of Object.entries(existingHq)) {
      const wId = Number(wIdStr);
      if (wId >= 200) {
        const targetId = LEGACY_PHANTOM_MAP[wId] || 68;
        if (!existingHq[targetId]) existingHq[targetId] = {};
        for (const [opName, qty] of Object.entries(ops as Record<string, number>)) {
          existingHq[targetId][opName] = Math.max(existingHq[targetId][opName] || 0, qty);
        }
        delete existingHq[wId];
        changed = true;
      }
    }

    if (computedHq) {
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
            if (curQty !== compQty) {
              currentWorkerOps[opName] = compQty;
              changed = true;
            }
          }
          existingHq[wId] = currentWorkerOps;
        }
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

