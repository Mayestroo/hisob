import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerDebouncedSave, flushDebouncedSave, cancelDebouncedSave } from '../debounceSave';

describe('debounceSave — Scoped and Keyed Debounced Persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelDebouncedSave();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces multiple calls with the same key so only the last task runs', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    triggerDebouncedSave(fn1, 500, 'worker');
    vi.advanceTimersByTime(200);
    triggerDebouncedSave(fn2, 500, 'worker');

    vi.advanceTimersByTime(300);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('allows different keys to run independently without cancelling each other', () => {
    const workerSave = vi.fn();
    const ticketSave = vi.fn();

    triggerDebouncedSave(workerSave, 500, 'worker');
    vi.advanceTimersByTime(200);
    triggerDebouncedSave(ticketSave, 500, 'ticket');

    vi.advanceTimersByTime(300);
    // workerSave delay was 500ms (200 + 300 = 500), so workerSave should fire now
    expect(workerSave).toHaveBeenCalledTimes(1);
    expect(ticketSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    // ticketSave delay was 500ms (300 + 200 = 500), so ticketSave should fire now
    expect(ticketSave).toHaveBeenCalledTimes(1);
  });

  it('flushDebouncedSave runs pending tasks immediately', () => {
    const fn = vi.fn();
    triggerDebouncedSave(fn, 1000, 'test_key');

    expect(fn).not.toHaveBeenCalled();
    flushDebouncedSave('test_key');
    expect(fn).toHaveBeenCalledTimes(1);

    // Further timer advance does not execute it again
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancelDebouncedSave cancels pending tasks', () => {
    const fn = vi.fn();
    triggerDebouncedSave(fn, 1000, 'to_cancel');

    cancelDebouncedSave('to_cancel');
    vi.advanceTimersByTime(2000);
    expect(fn).not.toHaveBeenCalled();
  });
});
