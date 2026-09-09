import { describe, it, expect } from 'vitest';
import { isNewerVersion } from '../updateService';

describe('isNewerVersion', () => {
  it('detects higher major version', () => {
    expect(isNewerVersion('2.0.0', '1.5.9')).toBe(true);
    expect(isNewerVersion('v2.0.0', '1.5.9')).toBe(true);
  });

  it('detects higher minor version', () => {
    expect(isNewerVersion('1.6.0', '1.5.9')).toBe(true);
    expect(isNewerVersion('1.6.0', 'v1.5.9')).toBe(true);
  });

  it('detects higher patch version', () => {
    expect(isNewerVersion('1.5.10', '1.5.9')).toBe(true);
  });

  it('returns false for same version', () => {
    expect(isNewerVersion('1.5.9', '1.5.9')).toBe(false);
    expect(isNewerVersion('v1.5.9', '1.5.9')).toBe(false);
  });

  it('returns false for older version', () => {
    expect(isNewerVersion('1.5.8', '1.5.9')).toBe(false);
    expect(isNewerVersion('1.4.9', '1.5.9')).toBe(false);
    expect(isNewerVersion('0.9.0', '1.5.9')).toBe(false);
  });
});
