import { describe, it, expect, vi } from 'vitest';
import { exportWorkersListToExcel } from '../excelSync';
import { Worker } from '../../types/workbook';
import XLSX from 'xlsx-js-style';

describe('exportWorkersListToExcel', () => {
  it('exports worker list with 1st col ID, 2nd col F.I.O, 3-7 cols empty, all with default borders', () => {
    let capturedWorkbook: any = null;
    let capturedFilename = '';

    const writeFileSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation((wb: any, fn: string) => {
      capturedWorkbook = wb;
      capturedFilename = fn;
    });

    const sampleWorkers: Worker[] = [
      { id: 2, name: 'Valiyev Vali' },
      { id: 1, name: 'Aliyev Ali' }
    ];

    exportWorkersListToExcel(sampleWorkers, 'Test_Ishchilar.xlsx');

    expect(writeFileSpy).toHaveBeenCalled();
    expect(capturedFilename).toBe('Test_Ishchilar.xlsx');
    expect(capturedWorkbook).toBeDefined();

    const sheet = capturedWorkbook.Sheets['Ishchilar'];
    expect(sheet).toBeDefined();

    // Check headers
    expect(sheet['A1'].v).toBe('ID raqami');
    expect(sheet['B1'].v).toBe('F.I.O');
    expect(sheet['C1'].v).toBe('');
    expect(sheet['D1'].v).toBe('');
    expect(sheet['E1'].v).toBe('');
    expect(sheet['F1'].v).toBe('');
    expect(sheet['G1'].v).toBe('');

    // Check borders on headers
    const expectedBorder = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    };
    expect(sheet['A1'].s.border).toEqual(expectedBorder);
    expect(sheet['G1'].s.border).toEqual(expectedBorder);

    // Row 2 should be worker with ID 1 (sorted)
    expect(sheet['A2'].v).toBe(1);
    expect(sheet['B2'].v).toBe('Aliyev Ali');
    expect(sheet['C2'].v).toBe('');
    expect(sheet['D2'].v).toBe('');
    expect(sheet['E2'].v).toBe('');
    expect(sheet['F2'].v).toBe('');
    expect(sheet['G2'].v).toBe('');

    // Check borders on row 2
    expect(sheet['A2'].s.border).toEqual(expectedBorder);
    expect(sheet['B2'].s.border).toEqual(expectedBorder);
    expect(sheet['C2'].s.border).toEqual(expectedBorder);
    expect(sheet['G2'].s.border).toEqual(expectedBorder);

    // Row 3 should be worker with ID 2
    expect(sheet['A3'].v).toBe(2);
    expect(sheet['B3'].v).toBe('Valiyev Vali');
    expect(sheet['C3'].v).toBe('');
    expect(sheet['G3'].s.border).toEqual(expectedBorder);

    // Column widths configured for 7 columns
    expect(sheet['!cols']).toHaveLength(7);

    writeFileSpy.mockRestore();
  });
});
