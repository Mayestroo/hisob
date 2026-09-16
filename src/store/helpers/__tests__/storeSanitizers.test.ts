import { describe, it, expect } from 'vitest';
import { sanitizeWorkers } from '../storeSanitizers';
import { Worker } from '../../../types/workbook';

describe('sanitizeWorkers', () => {
  it('preserves distinct legitimate workers <= 199 even if they share the same name', () => {
    const workers: Partial<Worker>[] = [
      { id: 95, name: 'Акбарова Муслима', staj: 0, avans: 0, jarima: 0 },
      { id: 98, name: 'Акбарова Муслима', staj: 0, avans: 0, jarima: 0 },
      { id: 198, name: 'МУМИНА ОПА', staj: 0, avans: 0, jarima: 0 },
      { id: 199, name: 'Абдумуталова Шахноза', staj: 0, avans: 0, jarima: 0 }
    ];

    const result = sanitizeWorkers(workers as Worker[]);
    expect(result).toHaveLength(4);
    expect(result.some((w) => w.id === 95)).toBe(true);
    expect(result.some((w) => w.id === 98)).toBe(true);
    expect(result.some((w) => w.id === 198)).toBe(true);
    expect(result.some((w) => w.id === 199)).toBe(true);
  });

  it('preserves workers with ID >= 200 (e.g. 200, 201, 210) and does not discard them', () => {
    const workers: Partial<Worker>[] = [
      { id: 112, name: 'УРАИМОВА МУНОЖАТХОН' },
      { id: 198, name: 'МУМИНА ОПА' },
      { id: 199, name: 'Абдумуталова Шахноза' },
      { id: 200, name: 'Янги ишчи 200' },
      { id: 201, name: 'Янги ишчи 201' },
      { id: 210, name: 'Янги ишчи 210' }
    ];

    const result = sanitizeWorkers(workers as Worker[]);
    expect(result).toHaveLength(6);
    expect(result.map((w) => w.id)).toEqual([112, 198, 199, 200, 201, 210]);
    expect(result.find((w) => w.id === 200)?.name).toBe('Янги ишчи 200');
    expect(result.find((w) => w.id === 210)?.name).toBe('Янги ишчи 210');
  });

  it('preserves edited worker #210 when user updates replacement name', () => {
    const workers: Partial<Worker>[] = [
      { id: 210, name: 'Эски ишчи кетди', updatedAt: 1000 },
      { id: 210, name: 'Янги ишчи келди', updatedAt: 2000 }
    ];

    const result = sanitizeWorkers(workers as Worker[]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(210);
    expect(result[0].name).toBe('Янги ишчи келди');
  });

  it('filters out invalid or non-numeric IDs and cleans whitespace', () => {
    const workers: any[] = [
      { id: null, name: 'Invalid' },
      { id: 0, name: 'Zero' },
      { id: -5, name: 'Negative' },
      { id: 205, name: '  Алишер   Валиев  ' }
    ];

    const result = sanitizeWorkers(workers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(205);
    expect(result[0].name).toBe('Алишер Валиев');
  });
});
