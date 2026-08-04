import { describe, it, expect } from 'vitest';
import { defineAbilityFor } from './ability';

describe('defineAbilityFor (CASL)', () => {
  it('accorde les permissions listées', () => {
    const a = defineAbilityFor([{ action: 'read', subject: 'Invoice' }, { action: 'create', subject: 'Payment' }]);
    expect(a.can('read', 'Invoice')).toBe(true);
    expect(a.can('create', 'Payment')).toBe(true);
  });
  it('« manage all » couvre toutes les actions', () => {
    const a = defineAbilityFor([{ action: 'manage', subject: 'all' }]);
    expect(a.can('update', 'Invoice')).toBe(true);
    expect(a.can('delete', 'StockMovement')).toBe(true);
  });
  it('refuse une permission absente', () => {
    const a = defineAbilityFor([{ action: 'read', subject: 'Invoice' }]);
    expect(a.can('delete', 'Payment')).toBe(false);
    expect(a.can('read', 'SupplierInvoice')).toBe(false);
  });
  it('gère une liste vide', () => {
    expect(defineAbilityFor([]).can('read', 'Invoice')).toBe(false);
  });
});
