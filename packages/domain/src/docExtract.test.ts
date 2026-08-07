import { describe, it, expect } from 'vitest';
import {
  parseFrAmount,
  parseFrDate,
  extractFromFacturX,
  extractFromText,
  analyzeDocument,
  guessExpenseCategory,
  toExpenseDraft,
  toSupplierInvoiceDraft,
} from './docExtract';
import { isValidSiren, isValidSiret, isValidIban } from './schemas';

const SIREN = '732829320';
const SIRET = '73282932000009';
const TVA = 'FR44732829320';
const IBAN = 'FR1420041010050500013M02606';

describe('parseFrAmount', () => {
  it.each([
    ['1 234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1234.56', 1234.56],
    ['120,00 €', 120],
    ['1 000', 1000],
    ['1.000', 1000],
    ['12,5', 12.5],
    ['0,99', 0.99],
    ['2 500 000,00', 2500000],
  ])('parse %s → %s', (raw, expected) => {
    expect(parseFrAmount(raw)).toBe(expected);
  });
  it('renvoie null sur entrée vide/invalide', () => {
    expect(parseFrAmount('')).toBeNull();
    expect(parseFrAmount(null)).toBeNull();
    expect(parseFrAmount('abc')).toBeNull();
  });
});

describe('parseFrDate', () => {
  it.each([
    ['12/03/2026', '2026-03-12'],
    ['01-01-2025', '2025-01-01'],
    ['5.7.2026', '2026-07-05'],
    ['09/08/26', '2026-08-09'],
  ])('parse %s → %s', (raw, iso) => {
    expect(parseFrDate(raw)).toBe(iso);
  });
  it('rejette les dates impossibles ou absentes', () => {
    expect(parseFrDate('32/01/2026')).toBeNull();
    expect(parseFrDate('12/13/2026')).toBeNull();
    expect(parseFrDate('pas de date')).toBeNull();
    expect(parseFrDate(null)).toBeNull();
  });
});

const FACTURX = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:x" xmlns:ram="urn:y" xmlns:udt="urn:z">
  <rsm:ExchangedDocument>
    <ram:ID>FA-2026-0042</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260312</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>Fournisseur Démo SARL</ram:Name>
        <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${SIRET}</ram:ID></ram:SpecifiedLegalOrganization>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${TVA}</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>100.00</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>100.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">20.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>120.00</ram:GrandTotalAmount>
        <ram:DuePayableAmount>120.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

describe('extractFromFacturX', () => {
  const res = extractFromFacturX(FACTURX);
  it('lit les champs structurés avec confiance haute', () => {
    expect(res.source).toBe('facturx');
    expect(res.fields.supplierName?.value).toBe('Fournisseur Démo SARL');
    expect(res.fields.invoiceNumber?.value).toBe('FA-2026-0042');
    expect(res.fields.date?.value).toBe('2026-03-12');
    expect(res.fields.siret?.value).toBe(SIRET);
    expect(res.fields.siret?.valid).toBe(true);
    expect(res.fields.tvaNumber?.value).toBe(TVA);
    expect(res.fields.totalHt?.value).toBe(100);
    expect(res.fields.totalTva?.value).toBe(20);
    expect(res.fields.totalTtc?.value).toBe(120);
    expect(res.fields.taxRatePct?.value).toBe(20);
    expect(res.fields.supplierName?.confidence).toBe('high');
  });
  it('ne signale ni incohérence ni champ à vérifier', () => {
    expect(res.warnings).toHaveLength(0);
    expect(res.needsReview).toHaveLength(0);
  });
  it('produit un résumé lisible', () => {
    expect(res.summary).toContain('Fournisseur Démo SARL');
    expect(res.summary).toContain('TTC 120,00');
  });
});

describe('extractFromText', () => {
  const text = [
    'Fournisseur Démo SARL',
    '12 rue des Lilas, 75011 Paris',
    `SIRET : ${SIRET.slice(0, 3)} ${SIRET.slice(3, 6)} ${SIRET.slice(6, 9)} ${SIRET.slice(9)}`,
    `N° TVA : ${TVA}`,
    `IBAN ${IBAN}`,
    'Facture n° FA-2026-0042',
    'Date : 12/03/2026',
    'Total HT : 100,00 €',
    'TVA 20% : 20,00 €',
    'Total TTC : 120,00 €',
  ].join('\n');
  const res = extractFromText(text);

  it('valide le SIRET et en déduit le SIREN', () => {
    expect(res.fields.siret?.value).toBe(SIRET);
    expect(res.fields.siret?.valid).toBe(true);
    expect(res.fields.siren?.value).toBe(SIREN);
  });
  it('valide la TVA intracommunautaire (clé DGFiP)', () => {
    expect(res.fields.tvaNumber?.value).toBe(TVA);
    expect(res.fields.tvaNumber?.valid).toBe(true);
  });
  it('valide l’IBAN (mod-97)', () => {
    expect(res.fields.iban?.value).toBe(IBAN);
    expect(res.fields.iban?.valid).toBe(true);
  });
  it('extrait n° de facture, date et totaux', () => {
    expect(res.fields.invoiceNumber?.value).toBe('FA-2026-0042');
    expect(res.fields.date?.value).toBe('2026-03-12');
    expect(res.fields.totalHt?.value).toBe(100);
    expect(res.fields.totalTva?.value).toBe(20);
    expect(res.fields.totalTtc?.value).toBe(120);
  });
  it('cohérence des totaux : aucune alerte', () => {
    expect(res.warnings).toHaveLength(0);
  });

  it('signale une incohérence de totaux', () => {
    const bad = 'Total HT : 100,00 €\nTVA : 20,00 €\nTotal TTC : 130,00 €';
    const r = extractFromText(bad);
    expect(r.warnings.some((w) => /Incoh[ée]rence/.test(w))).toBe(true);
  });

  it('déduit le TTC quand seuls HT et TVA sont présents', () => {
    const r = extractFromText('Total HT : 200,00\nTVA : 40,00');
    expect(r.fields.totalTtc?.value).toBe(240);
    expect(r.fields.totalTtc?.confidence).toBe('medium');
  });

  it('marque un SIRET invalide comme non validé et à vérifier', () => {
    const r = extractFromText('SIRET : 111 111 111 11111');
    expect(r.fields.siret?.valid).toBe(false);
    expect(r.needsReview).toContain('siret');
  });

  it('sans données reconnues → résumé neutre + champs à vérifier', () => {
    const r = extractFromText('123456');
    expect(r.summary).toMatch(/Aucune donnée/);
    expect(r.needsReview).toEqual(expect.arrayContaining(['date', 'totalTtc']));
  });
});

describe('analyzeDocument (cascade + fusion)', () => {
  it('Factur-X prioritaire sur le texte', () => {
    const res = analyzeDocument({ facturxXml: FACTURX, text: 'Total TTC : 999,00 €' });
    expect(res.source).toBe('facturx');
    expect(res.fields.totalTtc?.value).toBe(120); // le structuré (high) gagne sur le texte
  });
  it('bascule sur le texte si pas de Factur-X', () => {
    const res = analyzeDocument({ text: 'Total TTC : 120,00 €\nDate : 01/02/2026' });
    expect(res.source).toBe('pdf-text');
    expect(res.fields.totalTtc?.value).toBe(120);
  });
  it('un apport IA complète un champ manquant sans écraser un champ sûr', () => {
    const res = analyzeDocument({
      text: 'Total TTC : 120,00 €',
      aiFields: {
        totalTtc: { value: 999, confidence: 'medium', source: 'ai' },
        supplierName: { value: 'ACME', confidence: 'high', source: 'ai' },
      },
    });
    expect(res.fields.totalTtc?.value).toBe(120); // high (texte) conservé
    expect(res.fields.supplierName?.value).toBe('ACME'); // apport IA retenu
  });
  it('source « ai » quand seul l’apport IA est fourni', () => {
    const res = analyzeDocument({ aiFields: { totalTtc: { value: 50, confidence: 'high', source: 'ai' } } });
    expect(res.source).toBe('ai');
  });
  it('source « none » quand rien n’est fourni', () => {
    expect(analyzeDocument({}).source).toBe('none');
  });
});

describe('mapping vers brouillons', () => {
  it('guessExpenseCategory reconnaît les catégories courantes', () => {
    expect(guessExpenseCategory('Note hôtel Ibis')).toBe('hebergement');
    expect(guessExpenseCategory('Restaurant Le Zinc')).toBe('repas');
    expect(guessExpenseCategory('Billet SNCF Paris-Lyon')).toBe('deplacement');
    expect(guessExpenseCategory('Péage autoroute')).toBe('peage');
    expect(guessExpenseCategory('Papeterie bureau')).toBe('fournitures');
    expect(guessExpenseCategory('divers')).toBe('autre');
    expect(guessExpenseCategory(null)).toBe('autre');
  });

  it('toExpenseDraft calcule le HT depuis le TTC si besoin', () => {
    const res = analyzeDocument({ text: 'Total TTC : 120,00 €\nTVA 20%' });
    const draft = toExpenseDraft(res, 'Restaurant');
    expect(draft.category).toBe('repas');
    expect(draft.taxRatePct).toBe(20);
    expect(draft.amountHt).toBe(100);
  });

  it('toExpenseDraft fournit une description et une catégorie par défaut', () => {
    const draft = toExpenseDraft(analyzeDocument({}), null);
    expect(draft.category).toBe('autre');
    expect(draft.description.length).toBeGreaterThan(0);
  });

  it('toSupplierInvoiceDraft reprend les champs de la facture', () => {
    const res = extractFromFacturX(FACTURX);
    const draft = toSupplierInvoiceDraft(res);
    expect(draft.supplierName).toBe('Fournisseur Démo SARL');
    expect(draft.invoiceNumber).toBe('FA-2026-0042');
    expect(draft.totalTtc).toBe(120);
    expect(draft.tvaNumber).toBe(TVA);
  });
});

// Garde-fou : les fixtures sont réellement valides (sinon les tests de validité n'ont pas de sens).
describe('fixtures', () => {
  it('SIREN/SIRET/IBAN de test sont valides', () => {
    expect(isValidSiren(SIREN)).toBe(true);
    expect(isValidSiret(SIRET)).toBe(true);
    expect(isValidIban(IBAN)).toBe(true);
  });
});
