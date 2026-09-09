import { describe, it, expect } from 'vitest';
import { calculateModelTotals, calculateMasterPayroll, formatMoney, formatNumber } from '../formulaEngine';
import { ModelConfig, Worker } from '../../types/workbook';

describe('FormulaEngine — Payroll Calculations', () => {
  const sampleWorkers: Worker[] = [
    { id: 1, name: 'Ali Valiyev', staj: 50000, avans: 20000, jarima: 5000 },
    { id: 2, name: 'Vali Aliyev', staj: 0, avans: 10000, jarima: 0 },
    { id: 3, name: 'Hasan Husanov', staj: 0, avans: 0, jarima: 0 }
  ];

  const sampleModel: ModelConfig = {
    id: 'polo-tshirt',
    name: 'Polo-Tshirt',
    title: 'Model Polo-Tshirt',
    party: '1',
    color: "Ko'k",
    size: 'L',
    hisobSheetName: 'Polo-Tshirt-hisob',
    operations: [
      { id: 'op_1', name: 'Yoqa tikish', rate: 500, col: 3 },
      { id: 'op_2', name: 'Tugma qadash', rate: 200, col: 5 }
    ],
    pattaOpsOrder: ['Yoqa tikish', 'Tugma qadash'],
    hisobQuantities: {
      1: { 'Yoqa tikish': 100, 'Tugma qadash': 50 },  // 100*500 + 50*200 = 50000 + 10000 = 60000
      2: { 'Yoqa tikish': 40, 'Tugma qadash': 100 },  // 40*500 + 100*200 = 20000 + 20000 = 40000
      3: {} // 0
    }
  };

  it('calculateModelTotals calculates operation amounts and worker totals correctly', () => {
    const totals = calculateModelTotals(sampleModel, sampleWorkers);

    expect(totals.modelId).toBe('polo-tshirt');

    // Worker 1 earnings
    expect(totals.workerTotals[1].totalEarnings).toBe(60000);
    expect(totals.workerTotals[1].totalPieces).toBe(150);

    // Worker 2 earnings
    expect(totals.workerTotals[2].totalEarnings).toBe(40000);
    expect(totals.workerTotals[2].totalPieces).toBe(140);

    // Worker 3 has no work
    expect(totals.workerTotals[3].totalEarnings).toBe(0);
    expect(totals.workerTotals[3].totalPieces).toBe(0);

    // Operations totals
    expect(totals.operations['Yoqa tikish'].totalQuantity).toBe(140);
    expect(totals.operations['Yoqa tikish'].totalAmount).toBe(70000);
    expect(totals.operations['Tugma qadash'].totalQuantity).toBe(150);
    expect(totals.operations['Tugma qadash'].totalAmount).toBe(30000);

    // Grand totals
    expect(totals.grandTotalQuantity).toBe(290);
    expect(totals.grandTotalAmount).toBe(100000);
  });

  it('calculateMasterPayroll calculates gross, deductions and net salary (sof foyda) correctly', () => {
    const report = calculateMasterPayroll([sampleModel], sampleWorkers);

    expect(report.totalUmumiy).toBe(100000);
    expect(report.totalStaj).toBe(50000);
    expect(report.totalAvans).toBe(30000);
    expect(report.totalJarima).toBe(5000);

    // Worker 1: gross=60000, avans=20000, staj=50000, jarima=5000
    // sofFoyda = umumiy - avans - staj - jarima = 60000 - 20000 - 50000 - 5000 = -15000
    const w1 = report.workers.find((w) => w.workerId === 1);
    expect(w1).toBeDefined();
    expect(w1?.umumiy).toBe(60000);
    expect(w1?.staj).toBe(50000);
    expect(w1?.avans).toBe(20000);
    expect(w1?.jarima).toBe(5000);
    expect(w1?.sofFoyda).toBe(-15000);

    // Worker 2: gross=40000, avans=10000, staj=0, jarima=0
    // sofFoyda = 40000 - 10000 = 30000
    const w2 = report.workers.find((w) => w.workerId === 2);
    expect(w2).toBeDefined();
    expect(w2?.umumiy).toBe(40000);
    expect(w2?.sofFoyda).toBe(30000);

    expect(report.totalSofFoyda).toBe(-15000 + 30000 + 0);
  });

  it('formatMoney formats amounts with thousands separator correctly', () => {
    expect(formatMoney(0)).toBe('0');
    // ru-RU uses non-breaking space (\u00a0) or regular space depending on runtime
    expect(formatMoney(1500000).replace(/\s/g, ' ')).toBe('1 500 000');
    expect(formatNumber(2500).replace(/\s/g, ' ')).toBe('2 500');
  });
});
