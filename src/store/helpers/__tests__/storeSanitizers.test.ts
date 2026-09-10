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

  it('filters out phantom duplicates with ID > 199 that match base workers 1..199', () => {
    const workers: Partial<Worker>[] = [
      { id: 112, name: 'УРАИМОВА МУНОЖАТХОН' },
      { id: 198, name: 'МУМИНА ОПА' },
      { id: 199, name: 'Абдумуталова Шахноза' },
      { id: 200, name: 'Ураимова Муножат' }, // Phantom duplicate of 112
      { id: 201, name: 'МУМИНА ОПА' }        // Phantom duplicate of 198
    ];

    const result = sanitizeWorkers(workers as Worker[]);
    expect(result).toHaveLength(3);
    expect(result.map((w) => w.id)).toEqual([112, 198, 199]);
  });

  it('correctly eliminates phantom runaway IDs 402, 403, 409, 447 and merges staj', () => {
    const workers: Partial<Worker>[] = [
      { id: 12, name: 'АХМАДЖОНОВА МУХАЙЁ', staj: 0 },
      { id: 68, name: 'Умаркулова Мухаббат', staj: 0 },
      { id: 189, name: 'Ахмедова Фотима', staj: 0 },
      { id: 198, name: 'МУМИНА ОПА', staj: 0 },
      { id: 199, name: 'Абдумуталова Шахноза', staj: 0 },
      { id: 402, name: 'Тожикулова Гулнозахон', staj: 0 },
      { id: 403, name: 'МУМИНА ОПА', staj: 0 },
      { id: 409, name: 'Ураимова Мухаббат', staj: 0 },
      { id: 447, name: 'АХМАДЖОНОВ\uFFFD\uFFFD МУХАЙЁ', staj: 140000 }
    ];

    const result = sanitizeWorkers(workers as Worker[]);
    expect(result).toHaveLength(5);
    expect(result.map((w) => w.id)).toEqual([12, 68, 189, 198, 199]);
    // Staj from 447 must be merged into canonical worker 12
    const w12 = result.find((w) => w.id === 12);
    expect(w12?.staj).toBe(140000);
  });
});
