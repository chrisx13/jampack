import { describe, it, expect } from 'vitest';
import {
  RIGHTS_TREE, allLeafCodes, grantCovers, hasRight, expandGrants, nodeState, compactGrants, leavesByAction, PREDEFINED_ROLES,
} from './rights';

describe('grantCovers', () => {
  it('wildcard global', () => { expect(grantCovers('*', 'crm.clients.voir')).toBe(true); });
  it('wildcard de module', () => {
    expect(grantCovers('crm.*', 'crm.clients.voir')).toBe(true);
    expect(grantCovers('crm.*', 'ventes.factures.voir')).toBe(false);
  });
  it('droit exact', () => {
    expect(grantCovers('crm.clients.voir', 'crm.clients.voir')).toBe(true);
    expect(grantCovers('crm.clients.voir', 'crm.clients.creer')).toBe(false);
  });
});

describe('hasRight / expandGrants', () => {
  it('hasRight', () => {
    expect(hasRight(['crm.*'], 'crm.clients.creer')).toBe(true);
    expect(hasRight([], 'crm.clients.voir')).toBe(false);
  });
  it('expandGrants développe les feuilles', () => {
    expect(expandGrants(['*']).size).toBe(allLeafCodes().length);
    expect(expandGrants([]).size).toBe(0);
    expect([...expandGrants(['crm.*'])].every((l) => l.startsWith('crm.'))).toBe(true);
  });
});

describe('nodeState', () => {
  const all = new Set(allLeafCodes());
  it('checked si toutes les feuilles sélectionnées', () => { expect(nodeState('crm', all)).toBe('checked'); });
  it('unchecked si aucune', () => { expect(nodeState('crm', new Set())).toBe('unchecked'); });
  it('partial si une partie', () => {
    const one = new Set([allLeafCodes().find((l) => l.startsWith('crm.'))!]);
    expect(nodeState('crm', one)).toBe('partial');
  });
  it('unchecked pour un préfixe inconnu', () => { expect(nodeState('zzz', all)).toBe('unchecked'); });
});

describe('compactGrants', () => {
  it('tout coché → *', () => { expect(compactGrants(new Set(allLeafCodes()))).toEqual(['*']); });
  it('module entier → module.*', () => {
    const crm = new Set(allLeafCodes().filter((l) => l.startsWith('crm.')));
    expect(compactGrants(crm)).toContain('crm.*');
  });
  it('invariant expand(compact(x)) === x', () => {
    const sel = new Set(allLeafCodes().filter((_, i) => i % 3 === 0));
    expect(expandGrants(compactGrants(sel))).toEqual(sel);
  });
});

describe('leavesByAction & rôles prédéfinis', () => {
  it('leavesByAction ne renvoie que l’action demandée', () => {
    expect(leavesByAction('voir').every((l) => l.endsWith('.voir'))).toBe(true);
  });
  it('Administrateur = *', () => { expect(PREDEFINED_ROLES.Administrateur).toEqual(['*']); });
  it('Lecture seule = toutes les vues', () => { expect(PREDEFINED_ROLES['Lecture seule']).toEqual(leavesByAction('voir')); });
  it('l’arbre des droits est non vide et bien formé', () => {
    expect(RIGHTS_TREE.length).toBeGreaterThan(0);
    expect(RIGHTS_TREE.every((m) => m.key && m.domaines.length > 0)).toBe(true);
  });
});
