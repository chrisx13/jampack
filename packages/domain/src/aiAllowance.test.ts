import { describe, it, expect } from 'vitest';
import { allowanceDecision } from './aiAllowance';

describe('allowanceDecision', () => {
  it('dans la franchise → gratuit, autorisé', () => {
    expect(allowanceDecision({ usedThisMonth: 0, freeThreshold: 20, orgBalance: 0 })).toEqual({ charged: false, canProceed: true, freeRemaining: 19 });
  });
  it('dernière unité gratuite → gratuit, reste 0', () => {
    expect(allowanceDecision({ usedThisMonth: 19, freeThreshold: 20, orgBalance: 0 })).toEqual({ charged: false, canProceed: true, freeRemaining: 0 });
  });
  it('franchise épuisée + crédits → payant, autorisé', () => {
    expect(allowanceDecision({ usedThisMonth: 20, freeThreshold: 20, orgBalance: 5 })).toEqual({ charged: true, canProceed: true, freeRemaining: 0 });
  });
  it('franchise épuisée + aucun crédit → payant, bloqué', () => {
    expect(allowanceDecision({ usedThisMonth: 25, freeThreshold: 20, orgBalance: 0 })).toEqual({ charged: true, canProceed: false, freeRemaining: 0 });
  });
  it('seuil gratuit à 0 → toujours payant', () => {
    expect(allowanceDecision({ usedThisMonth: 0, freeThreshold: 0, orgBalance: 1 })).toMatchObject({ charged: true, canProceed: true });
    expect(allowanceDecision({ usedThisMonth: 0, freeThreshold: 0, orgBalance: 0 }).canProceed).toBe(false);
  });
});
