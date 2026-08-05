import { describe, it, expect, beforeAll } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;

beforeAll(async () => { C = await demoCaller(); caller = C.caller; });

/** Vérifie le câblage routeur + RLS des exports CSV (en-tête présent, fichier nommé). */
describe('Exports CSV — câblage & en-têtes', () => {
  it('écritures comptables', async () => {
    const r = await caller.accounting.entries.exportCsv();
    expect(r.filename).toBe('ecritures.csv');
    expect(r.content.split('\n')[0]).toBe('Journal;Date;N° pièce;Compte;Libellé;Débit;Crédit');
  });

  it('balance générale', async () => {
    const r = await caller.accounting.exportBalance();
    expect(r.filename).toBe('balance.csv');
    expect(r.content.split('\n')[0]).toBe('Compte;Libellé;Débit;Crédit;Solde');
  });

  it('notes de frais', async () => {
    const r = await caller.expenses.exportCsv();
    expect(r.filename).toBe('notes-de-frais.csv');
    expect(r.content.split('\n')[0]).toBe('Date;Catégorie;Description;Salarié;HT;TVA;TTC;Statut');
  });

  it('suivi du temps', async () => {
    const r = await caller.timeEntries.exportCsv();
    expect(r.filename).toBe('suivi-du-temps.csv');
    expect(r.content.split('\n')[0]).toBe('Date;Client;Description;Durée (h);Taux/h;Montant HT;Facturable;Statut');
  });

  it('mouvements de stock', async () => {
    const r = await caller.stock.movements.exportCsv();
    expect(r.filename).toBe('mouvements-stock.csv');
    expect(r.content.split('\n')[0]).toBe('Date;Type;Article;Entrepôt;Quantité;Coût unitaire;Lot;Péremption');
  });

  it('niveaux de stock', async () => {
    const r = await caller.stock.exportLevels();
    expect(r.filename).toBe('niveaux-stock.csv');
    expect(typeof r.content).toBe('string');
  });

  it('journal d\'audit', async () => {
    const r = await caller.audit.exportCsv();
    expect(r.filename).toBe('journal-audit.csv');
    expect(r.content.split('\n')[0]).toBe('Date;Utilisateur;Action;Référence');
  });
});
