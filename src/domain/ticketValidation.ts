import { ModelConfig, Worker, TicketFormState, PrintedPartyRecord, SubmittedTicketRecord } from '../types/workbook';

export interface TicketValidationResult {
  isValid: boolean;
  errorType?: 'warning' | 'error';
  title?: string;
  message?: string;
  actualPattaNum?: number;
  filledEntries?: Array<{ opName: string; workerId: number }>;
  partyOwner?: PrintedPartyRecord;
}

export interface TicketPartyStatus {
  partyOwner?: PrintedPartyRecord;
  isNonExistentParty: boolean;
  isWrongModelParty: boolean;
  minPattaForParty: number;
  maxPattaForParty: number;
  actualPattaNum: number;
  isExceededPattaNum: boolean;
  alreadySubmittedTicket?: SubmittedTicketRecord;
  hasBlockingError: boolean;
  errorBannerText: string;
}

/**
 * Computes party status for UI banner display in PattaView
 */
export function getTicketPartyStatus(
  form: TicketFormState,
  model: ModelConfig,
  printedPartyHistory: PrintedPartyRecord[],
  submittedTickets: SubmittedTicketRecord[],
  options?: { requireTicketValidation?: boolean }
): TicketPartyStatus {
  const isStrict = options?.requireTicketValidation !== false;
  const currentPartyStr = String(form.party || '');
  const currentPattaNum = parseInt(form.patta || '0', 10) || 0;

  if (!isStrict) {
    let alreadySubmittedTicket: SubmittedTicketRecord | undefined;
    if (currentPartyStr && currentPattaNum > 0) {
      alreadySubmittedTicket = (submittedTickets || []).find(
        (s) =>
          s.modelId === model.id &&
          String(s.partyNumber) === currentPartyStr &&
          s.pattaNumber === currentPattaNum
      );
    }
    const hasBlockingError = !!alreadySubmittedTicket;
    let errorBannerText = '';
    if (alreadySubmittedTicket) {
      errorBannerText = `Partiya ${currentPartyStr}, Patta ${currentPattaNum} allaqachon hisobga kiritilgan (${alreadySubmittedTicket.submittedAt} da)!`;
    }

    return {
      partyOwner: undefined,
      isNonExistentParty: false,
      isWrongModelParty: false,
      minPattaForParty: 1,
      maxPattaForParty: 999999,
      actualPattaNum: currentPattaNum || 1,
      isExceededPattaNum: false,
      alreadySubmittedTicket,
      hasBlockingError,
      errorBannerText
    };
  }

  const activeParties = (printedPartyHistory || []).filter((h) => !h.isClosed);
  const partyOwner = activeParties.find((h) => String(h.partyNumber) === currentPartyStr)
    || (printedPartyHistory || []).slice().reverse().find((h) => String(h.partyNumber) === currentPartyStr);

  const isNonExistentParty = !partyOwner;
  const isWrongModelParty = !!partyOwner && partyOwner.modelId !== model.id;

  const minPattaForParty = partyOwner
    ? (partyOwner.cumulativePattaCount > partyOwner.pattaCount
        ? partyOwner.cumulativePattaCount - partyOwner.pattaCount + 1
        : 1)
    : 1;
  const maxPattaForParty = partyOwner
    ? (partyOwner.cumulativePattaCount || partyOwner.pattaCount)
    : 1;

  let actualPattaNum = currentPattaNum;
  if (
    partyOwner &&
    currentPattaNum >= 1 &&
    currentPattaNum <= partyOwner.pattaCount &&
    minPattaForParty > 1 &&
    currentPattaNum < minPattaForParty
  ) {
    actualPattaNum = minPattaForParty + currentPattaNum - 1;
  }

  const isValidSequential = currentPattaNum >= minPattaForParty && currentPattaNum <= maxPattaForParty;
  const isValidRelative = currentPattaNum >= 1 && currentPattaNum <= (partyOwner?.pattaCount || 0);
  const isExceededPattaNum = !!partyOwner && partyOwner.modelId === model.id && !isValidSequential && !isValidRelative;

  const isArchivedInPreviousPeriod = !!(
    partyOwner &&
    partyOwner.archivedPattaNumbers &&
    (partyOwner.archivedPattaNumbers.includes(actualPattaNum) || partyOwner.archivedPattaNumbers.includes(currentPattaNum))
  );

  const alreadySubmittedTicket = (submittedTickets || []).find((s) => {
    if (partyOwner?.id && s.partyRecordId) {
      return s.partyRecordId === partyOwner.id && (s.pattaNumber === actualPattaNum || s.pattaNumber === currentPattaNum);
    }
    if (partyOwner && !partyOwner.isClosed) {
      return !s.isClosed && s.modelId === model.id && String(s.partyNumber) === currentPartyStr && (s.pattaNumber === actualPattaNum || s.pattaNumber === currentPattaNum);
    }
    return (
      s.modelId === model.id &&
      String(s.partyNumber) === currentPartyStr &&
      (s.pattaNumber === actualPattaNum || s.pattaNumber === currentPattaNum)
    );
  });

  const hasBlockingError = isNonExistentParty || isWrongModelParty || isExceededPattaNum || isArchivedInPreviousPeriod || !!alreadySubmittedTicket;

  let errorBannerText = '';
  if (isNonExistentParty) {
    errorBannerText = `Partiya ${currentPartyStr} hali chop etilmagan! Avval «Patta» varag'ida chop eting.`;
  } else if (isWrongModelParty) {
    errorBannerText = `Partiya ${currentPartyStr} «${partyOwner?.modelName}» modeli uchun chiqarilgan!`;
  } else if (isExceededPattaNum) {
    errorBannerText = minPattaForParty > 1
      ? `Partiya ${currentPartyStr} da pattalar ${minPattaForParty} dan ${maxPattaForParty} gacha (${partyOwner?.pattaCount} ta)!`
      : `Partiya ${currentPartyStr} da jami ${partyOwner?.pattaCount} ta patta bor!`;
  } else if (isArchivedInPreviousPeriod) {
    errorBannerText = `Partiya ${currentPartyStr}, Patta ${currentPattaNum} oldingi yopilgan oyda topshirilgan!`;
  } else if (alreadySubmittedTicket) {
    errorBannerText = `Partiya ${currentPartyStr}, Patta ${currentPattaNum} allaqachon hisobga kiritilgan (${alreadySubmittedTicket.submittedAt} da)!`;
  }

  return {
    partyOwner,
    isNonExistentParty,
    isWrongModelParty,
    minPattaForParty,
    maxPattaForParty,
    actualPattaNum,
    isExceededPattaNum,
    alreadySubmittedTicket,
    hasBlockingError,
    errorBannerText
  };
}

/**
 * Validates a ticket prior to submission (Jonatish)
 */
export function validateTicketForSubmission(
  form: TicketFormState,
  model: ModelConfig,
  workers: Worker[],
  printedPartyHistory: PrintedPartyRecord[],
  submittedTickets: SubmittedTicketRecord[],
  options?: { requireTicketValidation?: boolean }
): TicketValidationResult {
  const isStrict = options?.requireTicketValidation !== false;

  const qty = Number(form.qty);
  if (!qty || qty <= 0 || isNaN(qty)) {
    return {
      isValid: false,
      errorType: 'warning',
      title: 'Ish sonini kiriting',
      message: 'J3 dagi ish sonini kiriting (musbat butun son).'
    };
  }

  const filledEntries: Array<{ opName: string; workerId: number }> = [];
  for (const [opName, wVal] of Object.entries(form.entries)) {
    if (wVal !== '' && wVal !== undefined && wVal !== null) {
      let wId = Number(wVal);
      if (isNaN(wId) || wId <= 0) {
        return {
          isValid: false,
          errorType: 'error',
          title: "Noto'g'ri ishchi kodi",
          message: `Ishchi kodi noto'g'ri: "${wVal}"`
        };
      }
      const LEGACY_REMAP: Record<number, number> = {
        200: 112,
        201: 68,
        295: 189,
        303: 12,
        392: 71
      };
      if (wId >= 200 && LEGACY_REMAP[wId]) {
        wId = LEGACY_REMAP[wId];
      }
      const workerExists = workers.some((w) => w.id === wId);
      if (!workerExists) {
        return {
          isValid: false,
          errorType: 'error',
          title: 'Ishchi topilmadi',
          message: `Ishchi topilmadi (hisob varaqda)! Kodi: ${wId}`
        };
      }
      filledEntries.push({ opName, workerId: wId });
    }
  }

  if (filledEntries.length === 0) {
    return {
      isValid: false,
      errorType: 'warning',
      title: 'Ishchilar kiritilmadi',
      message: "Hech bo'lmaganda bitta operatsiyaga ishchi raqamini kiriting."
    };
  }

  const currentPartyStr = String(form.party || '');
  const currentPattaNum = parseInt(form.patta || '0', 10) || 0;

  if (!isStrict) {
    let alreadySubmitted: SubmittedTicketRecord | undefined;
    if (currentPartyStr && currentPattaNum > 0) {
      alreadySubmitted = (submittedTickets || []).find(
        (s) =>
          s.modelId === model.id &&
          String(s.partyNumber) === currentPartyStr &&
          s.pattaNumber === currentPattaNum
      );
    }
    if (alreadySubmitted) {
      return {
        isValid: false,
        errorType: 'error',
        title: 'Bu patta allaqachon kiritilgan!',
        message: `Partiya ${currentPartyStr}, Patta ${currentPattaNum} allaqachon hisobga o'tkazilgan (${alreadySubmitted.submittedAt || ''} da, ${alreadySubmitted.qty} dona).`
      };
    }

    return {
      isValid: true,
      actualPattaNum: currentPattaNum || 1,
      filledEntries,
      partyOwner: undefined
    };
  }

  const activeParties = (printedPartyHistory || []).filter((h) => !h.isClosed);
  const partyOwner = activeParties.find((h) => String(h.partyNumber) === currentPartyStr)
    || (printedPartyHistory || []).slice().reverse().find((h) => String(h.partyNumber) === currentPartyStr);

  if (!partyOwner) {
    return {
      isValid: false,
      errorType: 'error',
      title: 'Partiya topilmadi!',
      message: `Partiya ${currentPartyStr} mavjud emas (hali chop etilmagan)! Avval «Pattalar (Pechat)» varag'ida ushbu partiyani shakllantirib chop eting.`
    };
  }

  if (partyOwner.modelId !== model.id) {
    return {
      isValid: false,
      errorType: 'error',
      title: 'Model xato!',
      message: `Partiya ${currentPartyStr} «${partyOwner.modelName}» modeli uchun chiqarilgan! Ushbu partiyani «${model.name}» varag'iga kiritib bo'lmaydi. Iltimos, «${partyOwner.modelName}» varag'iga o'tib kiriting.`
    };
  }

  const minPattaForParty = partyOwner.cumulativePattaCount - partyOwner.pattaCount + 1;
  const maxPattaForParty = partyOwner.cumulativePattaCount;

  let actualPattaNum = currentPattaNum;
  if (
    currentPattaNum >= 1 &&
    currentPattaNum <= partyOwner.pattaCount &&
    minPattaForParty > 1 &&
    currentPattaNum < minPattaForParty
  ) {
    actualPattaNum = minPattaForParty + currentPattaNum - 1;
  }

  if (actualPattaNum < minPattaForParty || actualPattaNum > maxPattaForParty) {
    return {
      isValid: false,
      errorType: 'error',
      title: 'Patta raqami xato!',
      message: `Partiya ${currentPartyStr} da faqat ${minPattaForParty} dan ${maxPattaForParty} gacha patta chiqarilgan! Patta ${currentPattaNum} mavjud emas.`
    };
  }

  const alreadySubmitted = (submittedTickets || []).find((s) => {
    if (partyOwner?.id && s.partyRecordId) {
      return s.partyRecordId === partyOwner.id && s.pattaNumber === actualPattaNum;
    }
    if (partyOwner && !partyOwner.isClosed) {
      return !s.isClosed && s.modelId === model.id && String(s.partyNumber) === currentPartyStr && s.pattaNumber === actualPattaNum;
    }
    return (
      s.modelId === model.id &&
      String(s.partyNumber) === currentPartyStr &&
      s.pattaNumber === actualPattaNum
    );
  });

  if (alreadySubmitted) {
    return {
      isValid: false,
      errorType: 'error',
      title: 'Bu patta allaqachon kiritilgan!',
      message: `Partiya ${currentPartyStr}, Patta ${actualPattaNum} allaqachon hisobga o'tkazilgan (${alreadySubmitted.submittedAt || ''} da, ${alreadySubmitted.qty} dona). Bitta patta ikki marta kiritilishi mumkin emas!`
    };
  }

  return {
    isValid: true,
    actualPattaNum,
    filledEntries,
    partyOwner
  };
}
