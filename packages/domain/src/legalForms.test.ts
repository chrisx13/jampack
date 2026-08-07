import { describe, it, expect } from 'vitest';
import { LEGAL_FORMS, getLegalForm, legalFormDefaults, legalFormMentions, displayLegalName } from './legalForms';

describe('LEGAL_FORMS', () => {
  it('clés uniques', () => {
    const keys = LEGAL_FORMS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('couvre les formes courantes', () => {
    for (const k of ['EI', 'MICRO', 'SARL', 'EURL', 'SAS', 'SASU', 'SA', 'SCI', 'PROF_LIB', 'ASSO']) {
      expect(getLegalForm(k), `${k} manquante`).toBeTruthy();
    }
  });
  it('getLegalForm insensible à la casse, null sinon', () => {
    expect(getLegalForm('sarl')?.key).toBe('SARL');
    expect(getLegalForm('INCONNUE')).toBeUndefined();
    expect(getLegalForm(null)).toBeUndefined();
  });
});

describe('legalFormDefaults', () => {
  it('micro → franchise + compta micro', () => {
    expect(legalFormDefaults('MICRO')).toMatchObject({ vatFranchise: true, accounting: 'micro', hasCapital: false });
  });
  it('SARL → réel + engagement + capital', () => {
    expect(legalFormDefaults('SARL')).toMatchObject({ vatFranchise: false, accounting: 'engagement', hasCapital: true });
  });
  it('profession libérale → trésorerie', () => {
    expect(legalFormDefaults('PROF_LIB')?.accounting).toBe('tresorerie');
  });
  it('forme inconnue → null', () => {
    expect(legalFormDefaults('XXX')).toBeNull();
  });
});

describe('legalFormMentions', () => {
  it('société à capital : « FORME au capital de … » + RCS', () => {
    const m = legalFormMentions(getLegalForm('SARL'), { name: 'Acme', capital: '10 000 €', rcs: 'Paris B 123 456 789' });
    expect(m).toContain('SARL au capital de 10 000 €');
    expect(m).toContain('RCS Paris B 123 456 789');
  });
  it('EI : pas de capital, immatriculation RNE via SIREN', () => {
    const m = legalFormMentions(getLegalForm('EI'), { name: 'Dupont', siren: '732829320' });
    expect(m.some((x) => x.startsWith('EI'))).toBe(true);
    expect(m.some((x) => x.includes('RNE'))).toBe(true);
    expect(m.some((x) => x.includes('capital'))).toBe(false);
  });
  it('franchise en base → mention 293 B', () => {
    const m = legalFormMentions(getLegalForm('MICRO'), { name: 'Micro', vatFranchise: true });
    expect(m).toContain('TVA non applicable, art. 293 B du CGI');
  });
  it('TVA sur encaissements → mention', () => {
    const m = legalFormMentions(getLegalForm('SARL'), { name: 'Acme', vatOnPayments: true });
    expect(m.some((x) => /encaissements/.test(x))).toBe(true);
  });
  it('membre AGA → mention règlement chèque/CB accepté', () => {
    const m = legalFormMentions(getLegalForm('PROF_LIB'), { name: 'Cabinet', agaMember: true });
    expect(m.some((x) => /association de gestion agréée/.test(x))).toBe(true);
  });
});

describe('displayLegalName', () => {
  it('accole le tag EI si absent', () => {
    expect(displayLegalName(getLegalForm('EI'), 'Dupont Jean')).toBe('Dupont Jean — EI');
  });
  it('n’ajoute pas le tag si déjà présent', () => {
    expect(displayLegalName(getLegalForm('EI'), 'Dupont EI')).toBe('Dupont EI');
  });
  it('société sans tag : nom inchangé', () => {
    expect(displayLegalName(getLegalForm('SARL'), 'Acme')).toBe('Acme');
  });
});
