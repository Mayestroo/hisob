import * as XLSX from 'xlsx';
import { Worker, ModelConfig } from '../types/workbook';
import { calculateModelTotals, calculateMasterPayroll } from './formulaEngine';

function makeSheetName(name: string, usedNames: Set<string>): string {
  const baseName = (name || 'Sheet').replace(/[\\/:?*\[\]]/g, '_').slice(0, 31) || 'Sheet';
  let sheetName = baseName;
  let suffix = 1;
  while (usedNames.has(sheetName.toLowerCase())) {
    const suffixText = ` (${suffix++})`;
    sheetName = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
  }
  usedNames.add(sheetName.toLowerCase());
  return sheetName;
}

export function exportWorkbookToExcel(models: ModelConfig[], workers: Worker[], customFilename?: string) {
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  // 1. MASTER PAYROLL SHEET (Umumiy) - ALWAYS FIRST SHEET!
  const payroll = calculateMasterPayroll(models, workers);
  const umumiyData: any[][] = [];

  // Headers
  const uRow1: any[] = ['№', 'Исм фамилия', 'Соф фойда', 'Стаж', 'Аванс', 'Жарима', 'ЖАМИ'];
  for (const m of models) {
    uRow1.push(m.name);
  }
  umumiyData.push(uRow1);

  for (const wSummary of payroll.workers) {
    const row: any[] = [
      wSummary.workerId,
      wSummary.workerName,
      wSummary.sofFoyda,
      wSummary.staj > 0 ? wSummary.staj : '',
      wSummary.avans > 0 ? wSummary.avans : '',
      wSummary.jarima > 0 ? wSummary.jarima : '',
      wSummary.umumiy
    ];

    for (const m of models) {
      const earn = wSummary.earningsByModel[m.id] || 0;
      row.push(earn > 0 ? earn : '');
    }

    umumiyData.push(row);
  }

  // Totals row for Umumiy
  const uTotalRow: any[] = [
    'ЖАМИ',
    '',
    payroll.totalSofFoyda,
    payroll.totalStaj,
    payroll.totalAvans,
    payroll.totalJarima,
    payroll.totalUmumiy
  ];

  for (const m of models) {
    uTotalRow.push(payroll.modelTotals[m.id] || 0);
  }
  umumiyData.push(uTotalRow);

  const wsUmumiy = XLSX.utils.aoa_to_sheet(umumiyData);
  XLSX.utils.book_append_sheet(wb, wsUmumiy, makeSheetName('Umumiy', usedSheetNames));

  // 2. Export Patta and Hisob sheets
  for (const model of models) {
    // A. Patta Sheet
    const pattaData: any[][] = [];
    pattaData.push(['№', model.title, '', '', '', '', '', '', '', '']);
    pattaData.push(['', 'Сана- ', '', '', model.party, '', '', `Ранг ${model.color}`, 'Размер', 'сони ']);
    pattaData.push(['', '', '', '', '', '', '', '', model.size, '']);
    pattaData.push(['', '', '', '', 'Номер', 'Исм фамилия', '', '', 'Брак иш', '']);

    model.pattaOpsOrder.forEach((opName, idx) => {
      pattaData.push([idx + 1, opName, '', '', '', '', '', '', '', '']);
    });

    const wsPatta = XLSX.utils.aoa_to_sheet(pattaData);
    XLSX.utils.book_append_sheet(wb, wsPatta, makeSheetName(model.name, usedSheetNames));

    // B. Hisob Sheet
    const hisobData: any[][] = [];
    const row1: any[] = ['№', 'F.I.O'];
    const row2: any[] = ['', ''];

    for (const op of model.operations) {
      row1.push(op.name, '');
      row2.push(op.rate, 'Сони');
    }
    row1.push('ЖАМИ');
    row2.push('');

    hisobData.push(row1);
    hisobData.push(row2);

    const modelTotals = calculateModelTotals(model, workers);

    for (const worker of workers) {
      const row: any[] = [worker.id, worker.name];
      const workerQtyMap = (model.hisobQuantities && model.hisobQuantities[worker.id]) || {};

      for (const op of model.operations) {
        const qty = workerQtyMap[op.name] || 0;
        const amount = qty * op.rate;
        row.push(amount > 0 ? amount : '', qty > 0 ? qty : '');
      }

      const tot = modelTotals.workerTotals[worker.id]?.totalEarnings || 0;
      row.push(tot > 0 ? tot : 0);
      hisobData.push(row);
    }

    // Totals row
    const totalRow: any[] = ['ЖАМИ', ''];
    for (const op of model.operations) {
      const opTot = modelTotals.operations[op.name];
      totalRow.push(opTot?.totalAmount || 0, opTot?.totalQuantity || 0);
    }
    totalRow.push(modelTotals.grandTotalAmount);
    hisobData.push(totalRow);

    const wsHisob = XLSX.utils.aoa_to_sheet(hisobData);
    XLSX.utils.book_append_sheet(wb, wsHisob, makeSheetName(model.hisobSheetName, usedSheetNames));
  }

  // Trigger browser download
  const dateStr = new Date().toISOString().slice(0, 10);
  const finalFilename = customFilename || `Buxoro_Futbolka_Hisob_${dateStr}.xlsx`;
  XLSX.writeFile(wb, finalFilename);
}
