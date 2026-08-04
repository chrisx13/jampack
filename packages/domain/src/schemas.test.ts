import { describe, it, expect } from 'vitest';
import {
  computeInvoiceTotals, invoiceCreate, invoiceLineInput, invoiceUpdate, paymentCreate, supplierPaymentCreate, lmePaymentMention, parseBankStatementCsv, depreciationSchedule, reminderLevelLabel, dunningMessage,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SALES_DOCS, STOCK_KINDS, STOCK_KIND_LABELS,
  stockMovementCreate, stockInventory, productCreate, warehouseCreate, journalEntryCreate, accountCreate, journalCreate,
  purchaseOrderCreate, supplierInvoiceCreate, PCG_MINIMAL, JOURNAL_TYPES, JOURNAL_TYPE_LABELS, byId,
} from './schemas';

describe('computeInvoiceTotals', () => {
  it('somme HT/TVA/TTC ligne par ligne', () => {
    expect(computeInvoiceTotals([
      { quantity: 10, unitPriceHt: 5, taxRatePct: 20 },
      { quantity: 2, unitPriceHt: 50, taxRatePct: 5.5 },
    ])).toEqual({ totalHt: 150, totalTva: 15.5, totalTtc: 165.5 });
  });
  it('gère une liste vide', () => {
    expect(computeInvoiceTotals([])).toEqual({ totalHt: 0, totalTva: 0, totalTtc: 0 });
  });
  it('arrondit au centime', () => {
    const t = computeInvoiceTotals([{ quantity: 3, unitPriceHt: 0.1, taxRatePct: 20 }]);
    expect(t.totalHt).toBeCloseTo(0.3, 2);
    expect(t.totalTtc).toBeCloseTo(0.36, 2);
  });
});

describe('journalEntryCreate — équilibre', () => {
  const base = { journalId: 'j', date: '2026-01-01', label: 'x' };
  it('accepte une écriture équilibrée', () => {
    expect(journalEntryCreate.safeParse({ ...base, lines: [{ accountId: 'a', debit: 100, credit: 0 }, { accountId: 'b', debit: 0, credit: 100 }] }).success).toBe(true);
  });
  it('refuse un déséquilibre', () => {
    expect(journalEntryCreate.safeParse({ ...base, lines: [{ accountId: 'a', debit: 100, credit: 0 }, { accountId: 'b', debit: 0, credit: 90 }] }).success).toBe(false);
  });
  it('refuse une écriture nulle', () => {
    expect(journalEntryCreate.safeParse({ ...base, lines: [{ accountId: 'a', debit: 0, credit: 0 }, { accountId: 'b', debit: 0, credit: 0 }] }).success).toBe(false);
  });
  it('exige au moins 2 lignes', () => {
    expect(journalEntryCreate.safeParse({ ...base, lines: [{ accountId: 'a', debit: 100, credit: 0 }] }).success).toBe(false);
  });
});

describe('stockMovementCreate', () => {
  it('accepte une quantité non nulle (signée pour ajustement)', () => {
    expect(stockMovementCreate.safeParse({ warehouseId: 'w', productId: 'p', kind: 'entree', quantity: 5 }).success).toBe(true);
    expect(stockMovementCreate.safeParse({ warehouseId: 'w', productId: 'p', kind: 'ajustement', quantity: -5 }).success).toBe(true);
  });
  it('refuse une quantité nulle', () => {
    expect(stockMovementCreate.safeParse({ warehouseId: 'w', productId: 'p', kind: 'sortie', quantity: 0 }).success).toBe(false);
  });
  it('refuse un type invalide', () => {
    expect(stockMovementCreate.safeParse({ warehouseId: 'w', productId: 'p', kind: 'bogus', quantity: 1 }).success).toBe(false);
  });
});

describe('productCreate — seuil de réapprovisionnement', () => {
  it('accepte un reorderPoint positif, nul, absent ou null', () => {
    expect(productCreate.safeParse({ name: 'A', reorderPoint: 10 }).success).toBe(true);
    expect(productCreate.safeParse({ name: 'A', reorderPoint: 0 }).success).toBe(true);
    expect(productCreate.safeParse({ name: 'A', reorderPoint: null }).success).toBe(true);
    expect(productCreate.safeParse({ name: 'A' }).success).toBe(true);
  });
  it('refuse un reorderPoint négatif', () => {
    expect(productCreate.safeParse({ name: 'A', reorderPoint: -1 }).success).toBe(false);
  });
});

describe('depreciationSchedule (amortissement linéaire)', () => {
  it('1200 € sur 3 ans, acquisition 1er janvier → 3 annuités de 400', () => {
    const s = depreciationSchedule(1200, 3, new Date('2026-01-15'));
    expect(s).toHaveLength(3);
    expect(s.map((r) => r.annuity)).toEqual([400, 400, 400]);
    expect(s[2].residual).toBe(0);
  });
  it('prorata au 1er juillet → [200, 400, 400, 200]', () => {
    const s = depreciationSchedule(1200, 3, new Date('2026-07-10'));
    expect(s.map((r) => r.annuity)).toEqual([200, 400, 400, 200]);
    expect(s[s.length - 1].residual).toBe(0);
    expect(s[0].year).toBe(2026);
  });
});

describe('relances (dunning)', () => {
  it('libellés de niveau', () => {
    expect(reminderLevelLabel(0)).toBe('Aucune relance');
    expect(reminderLevelLabel(1)).toContain('Relance 1');
    expect(reminderLevelLabel(3)).toContain('mise en demeure');
    expect(reminderLevelLabel(9)).toContain('mise en demeure'); // borné
  });
  it('message de relance : ton progressif + données', () => {
    const m2 = dunningMessage(2, { number: 'FA-0001', amount: '120,00 €', dueDate: '01/09/2026' });
    expect(m2).toContain('FA-0001');
    expect(m2).toContain('120,00 €');
    expect(m2).toContain('indemnité forfaitaire');
    expect(dunningMessage(3, { number: 'X', amount: '1 €', dueDate: 'x' })).toContain('mise en demeure');
  });
});

describe('parseBankStatementCsv', () => {
  it('parse un relevé FR (séparateur ;, décimale ,) et ignore l’en-tête', () => {
    const csv = 'Date;Libellé;Montant\n2026-08-04;Virement client Dupont;120,00\n2026-08-05;Achat fournitures;-45,50\n';
    const r = parseBankStatementCsv(csv);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ date: '2026-08-04', label: 'Virement client Dupont', amount: 120 });
    expect(r[1].amount).toBeCloseTo(-45.5, 2);
  });
  it('accepte le séparateur , et ignore les lignes vides/invalides', () => {
    expect(parseBankStatementCsv('2026-08-04,Vente,60.00\n\n,,\n')).toEqual([{ date: '2026-08-04', label: 'Vente', amount: 60 }]);
  });
});

describe('lmePaymentMention', () => {
  it('porte l’indemnité 40 € et le taux par défaut (LME)', () => {
    const m = lmePaymentMention();
    expect(m).toContain('40 €');
    expect(m).toContain('indemnité forfaitaire');
    expect(m).toContain("trois fois le taux d'intérêt légal");
    expect(m).toContain('L441-10');
  });
  it('utilise le taux fourni par la société', () => {
    expect(lmePaymentMention('10 % annuel')).toContain('au taux de 10 % annuel');
    expect(lmePaymentMention('   ')).toContain("trois fois le taux d'intérêt légal"); // blanc → défaut
  });
});

describe('stockInventory', () => {
  it('exige entrepôt, article et quantité comptée ≥ 0', () => {
    expect(stockInventory.safeParse({ warehouseId: 'w', productId: 'p', countedQuantity: 30 }).success).toBe(true);
    expect(stockInventory.safeParse({ warehouseId: 'w', productId: 'p', countedQuantity: 0 }).success).toBe(true);
    expect(stockInventory.safeParse({ warehouseId: 'w', productId: 'p', countedQuantity: -1 }).success).toBe(false);
    expect(stockInventory.safeParse({ productId: 'p', countedQuantity: 1 }).success).toBe(false);
  });
});

describe('schémas de saisie', () => {
  it('invoiceLineInput valide/refuse', () => {
    expect(invoiceLineInput.safeParse({ label: 'x', quantity: 1, unitPriceHt: 10, taxRatePct: 20 }).success).toBe(true);
    expect(invoiceLineInput.safeParse({ label: 'x', quantity: -1, unitPriceHt: 10, taxRatePct: 20 }).success).toBe(false);
    expect(invoiceLineInput.safeParse({ label: 'x', quantity: 1, unitPriceHt: 10, taxRatePct: 200 }).success).toBe(false);
  });
  it('invoiceCreate applique lines=[] par défaut ; invoiceUpdate exige un id', () => {
    expect(invoiceCreate.parse({ companyId: 'c' }).lines).toEqual([]);
    expect(invoiceUpdate.safeParse({ companyId: 'c' }).success).toBe(false);
  });
  it('paymentCreate exige un montant positif et une méthode valide', () => {
    expect(paymentCreate.safeParse({ invoiceId: 'i', amount: 10, method: 'virement' }).success).toBe(true);
    expect(paymentCreate.safeParse({ invoiceId: 'i', amount: 0 }).success).toBe(false);
    expect(paymentCreate.safeParse({ invoiceId: 'i', amount: 10, method: 'bogus' }).success).toBe(false);
  });
  it('supplierPaymentCreate exige un montant positif et une méthode valide', () => {
    expect(supplierPaymentCreate.safeParse({ supplierInvoiceId: 'i', amount: 10, method: 'virement' }).success).toBe(true);
    expect(supplierPaymentCreate.safeParse({ supplierInvoiceId: 'i', amount: 0 }).success).toBe(false);
    expect(supplierPaymentCreate.safeParse({ supplierInvoiceId: 'i', amount: 10, method: 'bogus' }).success).toBe(false);
    expect(supplierPaymentCreate.safeParse({ amount: 10 }).success).toBe(false);
  });
  it('account/journal/warehouse/PO/facture-fournisseur/byId', () => {
    expect(accountCreate.safeParse({ code: '707000', name: 'Ventes' }).success).toBe(true);
    expect(journalCreate.safeParse({ code: 'VT', name: 'Ventes', type: 'vente' }).success).toBe(true);
    expect(journalCreate.safeParse({ code: 'VT', name: 'Ventes', type: 'bogus' }).success).toBe(false);
    expect(warehouseCreate.safeParse({ name: 'Dépôt' }).success).toBe(true);
    expect(purchaseOrderCreate.parse({ supplierId: 's' }).lines).toEqual([]);
    expect(supplierInvoiceCreate.parse({ supplierId: 's' }).lines).toEqual([]);
    expect(byId.safeParse({ id: '' }).success).toBe(false);
    expect(byId.safeParse({ id: 'x' }).success).toBe(true);
  });
});

describe('constantes & tables', () => {
  it('SALES_DOCS cohérent', () => {
    expect(Object.keys(SALES_DOCS)).toEqual(['devis', 'facture', 'avoir']);
    expect(SALES_DOCS.facture.seqType).toBe('facture');
    expect(SALES_DOCS.devis.issuedStatus).toBe('sent');
    expect(SALES_DOCS.avoir.subject).toBe('CreditNote');
  });
  it('libellés complets', () => {
    expect(PAYMENT_METHODS.every((m) => PAYMENT_METHOD_LABELS[m])).toBe(true);
    expect(STOCK_KINDS.every((k) => STOCK_KIND_LABELS[k])).toBe(true);
    expect(JOURNAL_TYPES.every((t) => JOURNAL_TYPE_LABELS[t])).toBe(true);
  });
  it('PCG minimal contient les comptes clés', () => {
    const codes = PCG_MINIMAL.map((a) => a.code);
    expect(codes).toEqual(expect.arrayContaining(['401000', '411000', '445710', '445660', '512000', '707000']));
  });
});
