import { describe, it, expect } from 'vitest';
import { parseJsonObject, fieldsFromRaw } from './aiFields';
import { analyzeDocument } from './docExtract';

const SIREN = '732829320';
const SIRET = '73282932000009';
const TVA = 'FR44732829320';
const IBAN = 'FR1420041010050500013M02606';

describe('parseJsonObject', () => {
  it('extrait un objet JSON pur', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('extrait le JSON même entouré de texte', () => {
    expect(parseJsonObject('Voici le résultat : {"totalTtc": 120} merci')).toEqual({ totalTtc: 120 });
  });
  it('renvoie null si pas de JSON ou JSON invalide', () => {
    expect(parseJsonObject('aucun objet')).toBeNull();
    expect(parseJsonObject('{cassé')).toBeNull();
    expect(parseJsonObject('{ pas: du json }')).toBeNull();
  });
});

describe('fieldsFromRaw', () => {
  it('mappe et VALIDE les identifiants (indépendamment du modèle)', () => {
    const f = fieldsFromRaw({ supplierName: 'ACME', siret: SIRET, tvaNumber: TVA, iban: IBAN, date: '2026-03-12', totalTtc: 120, totalHt: 100, totalTva: 20, taxRatePct: 20 });
    expect(f.siret?.valid).toBe(true);
    expect(f.siren?.value).toBe(SIREN);
    expect(f.tvaNumber?.valid).toBe(true);
    expect(f.iban?.valid).toBe(true);
    expect(f.totalTtc?.value).toBe(120);
    expect(f.date?.value).toBe('2026-03-12');
    expect(f.supplierName?.source).toBe('ai');
  });

  it('marque comme non valide un identifiant erroné renvoyé par le modèle', () => {
    const f = fieldsFromRaw({ siret: '11111111111111', iban: 'FR00' });
    expect(f.siret?.valid).toBe(false);
    expect(f.siret?.confidence).toBe('low');
    // IBAN trop court → invalide
    expect(f.iban?.valid).toBe(false);
  });

  it('ignore les champs nuls/absents', () => {
    const f = fieldsFromRaw({ supplierName: null, totalTtc: undefined });
    expect(f.supplierName).toBeUndefined();
    expect(f.totalTtc).toBeUndefined();
  });

  it('accepte des montants en chaîne à la française', () => {
    const f = fieldsFromRaw({ totalTtc: '120,50' as unknown as number });
    expect(f.totalTtc?.value).toBe(120.5);
  });

  it('rejette une date au mauvais format', () => {
    expect(fieldsFromRaw({ date: '12/03/2026' }).date).toBeUndefined();
  });
});

describe('fusion apport IA dans la cascade', () => {
  it('l’IA complète les champs manquants sans écraser un total sûr', () => {
    const ai = fieldsFromRaw({ supplierName: 'ACME', totalTtc: 999 });
    const res = analyzeDocument({ text: 'Total TTC : 120,00 €', aiFields: ai });
    expect(res.fields.supplierName?.value).toBe('ACME'); // apport IA
    expect(res.fields.totalTtc?.value).toBe(120); // local (high) conservé
  });
});
