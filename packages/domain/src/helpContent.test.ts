import { describe, it, expect } from 'vitest';
import { HELP_ARTICLES, searchHelp, scoreArticle, getArticle } from './helpContent';

describe('HELP_ARTICLES', () => {
  it('ids uniques, chaque article a des étapes', () => {
    const ids = HELP_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of HELP_ARTICLES) expect(a.steps.length, `${a.id} sans étapes`).toBeGreaterThan(0);
  });
  it('les liens « related » pointent vers des articles existants', () => {
    const ids = new Set(HELP_ARTICLES.map((a) => a.id));
    for (const a of HELP_ARTICLES) for (const r of a.related ?? []) expect(ids.has(r), `${a.id} → ${r} inexistant`).toBe(true);
  });
});

describe('searchHelp', () => {
  it('trouve la reconnaissance de documents', () => {
    const r = searchHelp('scanner une facture');
    expect(r[0].id).toBe('scanner');
  });
  it('recherche insensible aux accents', () => {
    expect(searchHelp('societe').some((a) => a.id === 'demarrage-connexion')).toBe(true);
    expect(searchHelp('déclaration tva').some((a) => a.id === 'compta-tva')).toBe(true);
  });
  it('trouve les crédits IA (gratuit vs payant)', () => {
    expect(searchHelp('crédit ia payant').some((a) => a.id === 'credits-ia')).toBe(true);
  });
  it('renvoie vide si aucune correspondance', () => {
    expect(searchHelp('xyzzy azerty')).toHaveLength(0);
  });
  it('classe par pertinence (titre prioritaire)', () => {
    const r = searchHelp('devis');
    expect(r[0].id).toBe('ventes-devis');
  });
  it('respecte la limite', () => {
    expect(searchHelp('facture', 2).length).toBeLessThanOrEqual(2);
  });
});

describe('scoreArticle / getArticle', () => {
  it('score nul pour requête vide', () => {
    expect(scoreArticle(HELP_ARTICLES[0], '')).toBe(0);
  });
  it('getArticle retrouve par id', () => {
    expect(getArticle('scanner')?.category).toBe('IA & documents');
    expect(getArticle('inconnu')).toBeUndefined();
  });
});
