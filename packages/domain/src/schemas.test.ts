import { describe, it, expect } from 'vitest';
import {
  computeInvoiceTotals, invoiceCreate, invoiceLineInput, invoiceUpdate, paymentCreate,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SALES_DOCS, STOCK_KINDS, STOCK_KIND_LABELS,
  stockMovementCreate, warehouseCreate, journalEntryCreate, accountCreate, journalCreate,
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
