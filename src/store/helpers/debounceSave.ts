let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerDebouncedSave(saveFn: () => void, delayMs = 1200): void {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    saveFn();
  }, delayMs);
}
