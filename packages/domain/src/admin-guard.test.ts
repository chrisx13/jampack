import { describe, it, expect } from 'vitest';
import { activeAdminCount, violatesLastActiveAdmin } from './admin-guard';

const M = (userActive: boolean, hasActiveAdminRole: boolean, userId = 'u') => ({ userId, userActive, hasActiveAdminRole });

describe('admin-guard', () => {
  it('compte les administrateurs actifs (user actif ET rôle admin actif)', () => {
    expect(activeAdminCount([M(true, true, 'a'), M(true, false, 'b'), M(false, true, 'c')])).toBe(1);
    expect(activeAdminCount([])).toBe(0);
  });
  it('interdit l’opération laissant 0 administrateur actif', () => {
    expect(violatesLastActiveAdmin([M(false, true), M(true, false)])).toBe(true);
    expect(violatesLastActiveAdmin([])).toBe(true);
  });
  it('autorise tant qu’il reste un administrateur actif', () => {
    expect(violatesLastActiveAdmin([M(true, true), M(true, false)])).toBe(false);
  });
});
