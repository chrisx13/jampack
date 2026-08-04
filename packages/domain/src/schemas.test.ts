import { describe, it, expect } from 'vitest';
import {
  computeInvoiceTotals, invoiceCreate, invoiceLineInput, invoiceUpdate, paymentCreate, supplierPaymentCreate, lmePaymentMention, parseBankStatementCsv, depreciationSchedule, reminderLevelLabel, dunningMessage,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SALES_DOCS, STOCK_KINDS, STOCK_KIND_LABELS,
  stockMovementCreate, stockInventory, productCreate, warehouseCreate, journalEntryCreate, accountCreate, journalCreate,
  purchaseOrderCreate, supplierInvoiceCreate, PCG_MINIMAL, JOURNAL_TYPES, JOURNAL_TYPE_LABELS, byId,
  activityCreate, activityTypeLabel, isActivityOverdue, stockTransfer,
  isPurchaseOrderOverdue, purchaseOrderDaysLate, parseProductsCsv,
  isQuoteExpired, quoteDaysToExpiry, stockLevelsCsv, purchaseReceipt, balanceCsv, buildAgendaIcs, auditLogCsv,
  discountMention, DISCOUNT_MENTION_NONE,
  isValidSiren, isValidSiret, frTvaNumber,
  isValidIban, isValidBic, formatIban, ledgerCsv, depositLines,
} from './schemas';

describe('computeInvoiceTotals', () => {
  it('somme HT/TVA/TTC ligne par ligne', () => {
    expect(computeInvoiceTotals([
      { quantity: 10, unitPriceHt: 5, taxRatePct: 20 },
      { quantity: 2, unitPriceHt: 50, taxRatePct: 5.5 },
    ])).toMatchObject({ totalHt: 150, totalTva: 15.5, totalTtc: 165.5 });
  });
  it('gère une liste vide', () => {
    expect(computeInvoiceTotals([])).toMatchObject({ totalHt: 0, totalTva: 0, totalTtc: 0 });
  });
  it('arrondit au centime', () => {
    const t = computeInvoiceTotals([{ quantity: 3, unitPriceHt: 0.1, taxRatePct: 20 }]);
    expect(t.totalHt).toBeCloseTo(0.3, 2);
    expect(t.totalTtc).toBeCloseTo(0.36, 2);
  });
  it('remise globale en pourcentage (TVA par taux préservée)', () => {
    const t = computeInvoiceTotals(
      [{ quantity: 10, unitPriceHt: 10, taxRatePct: 20 }, { quantity: 1, unitPriceHt: 100, taxRatePct: 5.5 }],
      { discountType: 'percent', discountValue: 10 },
    );
    expect(t.grossHt).toBe(200);
    expect(t.totalHt).toBe(180);         // 100→90 (TVA 20) + 100→90 (TVA 5,5)
    expect(t.discountHt).toBe(20);
    expect(t.totalTva).toBeCloseTo(90 * 0.2 + 90 * 0.055, 2); // 18 + 4,95 = 22,95
    expect(t.totalTtc).toBeCloseTo(202.95, 2);
  });
  it('remise globale en montant (répartie proportionnellement)', () => {
    const t = computeInvoiceTotals(
      [{ quantity: 1, unitPriceHt: 100, taxRatePct: 20 }, { quantity: 1, unitPriceHt: 100, taxRatePct: 20 }],
      { discountType: 'amount', discountValue: 50 },
    );
    expect(t.grossHt).toBe(200);
    expect(t.totalHt).toBe(150);
    expect(t.discountHt).toBe(50);
  });
  it('remise ignorée si type none ou valeur nulle', () => {
    expect(computeInvoiceTotals([{ quantity: 1, unitPriceHt: 100, taxRatePct: 20 }], { discountType: 'none', discountValue: 10 }).totalHt).toBe(100);
    expect(computeInvoiceTotals([{ quantity: 1, unitPriceHt: 100, taxRatePct: 20 }], { discountType: 'percent', discountValue: 0 }).totalHt).toBe(100);
  });
});

describe('depositLines — facture d\'acompte', () => {
  it('acompte 30 % réparti par taux de TVA', () => {
    const dl = depositLines(
      [{ quantity: 1, unitPriceHt: 1000, taxRatePct: 20 }, { quantity: 1, unitPriceHt: 200, taxRatePct: 5.5 }],
      undefined, 30,
    );
    expect(dl).toHaveLength(2);
    expect(dl[0]).toMatchObject({ unitPriceHt: 300, taxRatePct: 20 });  // 1000 × 30 %
    expect(dl[1]).toMatchObject({ unitPriceHt: 60, taxRatePct: 5.5 });   // 200 × 30 %
  });
  it('acompte sur base nette (remise globale prise en compte)', () => {
    const dl = depositLines(
      [{ quantity: 1, unitPriceHt: 1000, taxRatePct: 20 }],
      { discountType: 'percent', discountValue: 10 }, 50,
    );
    expect(dl[0].unitPriceHt).toBe(450); // (1000 − 10 %) × 50 % = 900 × 0,5
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

describe('activités CRM', () => {
  it('libellés de type', () => {
    expect(activityTypeLabel('appel')).toBe('Appel');
    expect(activityTypeLabel('rdv')).toBe('Rendez-vous');
    expect(activityTypeLabel('inconnu')).toBe('inconnu');
  });
  it('exige un rattachement (client, contact ou opportunité)', () => {
    expect(activityCreate.safeParse({ type: 'note', content: 'x' }).success).toBe(false);
    expect(activityCreate.safeParse({ type: 'note', content: 'x', companyId: 'c1' }).success).toBe(true);
  });
  it('tâche en retard : échéance dépassée et non terminée', () => {
    const now = new Date('2026-08-04T12:00:00Z');
    expect(isActivityOverdue({ type: 'tache', done: false, dueAt: '2026-08-01T00:00:00Z' }, now)).toBe(true);
    expect(isActivityOverdue({ type: 'tache', done: true, dueAt: '2026-08-01T00:00:00Z' }, now)).toBe(false);
    expect(isActivityOverdue({ type: 'tache', done: false, dueAt: '2026-08-10T00:00:00Z' }, now)).toBe(false);
    expect(isActivityOverdue({ type: 'note', done: false, dueAt: '2026-08-01T00:00:00Z' }, now)).toBe(false);
  });
});

describe('devis — validité & expiration', () => {
  const now = new Date('2026-08-04T12:00:00Z');
  it('expiré : émis + date de validité dépassée', () => {
    expect(isQuoteExpired({ status: 'sent', validUntil: '2026-08-01T00:00:00Z' }, now)).toBe(true);
    expect(quoteDaysToExpiry({ status: 'sent', validUntil: '2026-08-01T00:00:00Z' }, now)).toBeLessThan(0);
  });
  it('valide : émis + date future', () => {
    expect(isQuoteExpired({ status: 'sent', validUntil: '2026-08-20T00:00:00Z' }, now)).toBe(false);
    expect(quoteDaysToExpiry({ status: 'sent', validUntil: '2026-08-20T00:00:00Z' }, now)).toBeGreaterThan(0);
  });
  it('non applicable : accepté, converti, ou sans date', () => {
    expect(isQuoteExpired({ status: 'accepted', validUntil: '2026-08-01T00:00:00Z' }, now)).toBe(false);
    expect(quoteDaysToExpiry({ status: 'sent', validUntil: null }, now)).toBeNull();
  });
});

describe('purchaseReceipt (réception partielle)', () => {
  it('accepte des quantités reçues par ligne', () => {
    expect(purchaseReceipt.safeParse({ id: 'po1', lines: [{ lineId: 'l1', quantity: 5 }] }).success).toBe(true);
  });
  it('rejette une liste vide ou une quantité négative', () => {
    expect(purchaseReceipt.safeParse({ id: 'po1', lines: [] }).success).toBe(false);
    expect(purchaseReceipt.safeParse({ id: 'po1', lines: [{ lineId: 'l1', quantity: -1 }] }).success).toBe(false);
  });
});

describe('commandes fournisseurs en retard', () => {
  const now = new Date('2026-08-04T12:00:00Z');
  it('en retard : envoyée + date prévue dépassée', () => {
    expect(isPurchaseOrderOverdue({ status: 'sent', expectedDate: '2026-08-01T00:00:00Z' }, now)).toBe(true);
    expect(purchaseOrderDaysLate({ status: 'sent', expectedDate: '2026-08-01T00:00:00Z' }, now)).toBe(3);
  });
  it('pas en retard : réceptionnée, sans date, ou date future', () => {
    expect(isPurchaseOrderOverdue({ status: 'received', expectedDate: '2026-08-01T00:00:00Z' }, now)).toBe(false);
    expect(isPurchaseOrderOverdue({ status: 'sent', expectedDate: null }, now)).toBe(false);
    expect(isPurchaseOrderOverdue({ status: 'sent', expectedDate: '2026-08-10T00:00:00Z' }, now)).toBe(false);
    expect(purchaseOrderDaysLate({ status: 'received', expectedDate: '2026-08-01T00:00:00Z' }, now)).toBe(0);
  });
});

describe('buildAgendaIcs', () => {
  it('produit un VCALENDAR avec un VEVENT journée par entrée et échappe les caractères', () => {
    const ics = buildAgendaIcs([{ uid: 'task-1', date: '2026-08-10T09:00:00Z', summary: 'Relancer; client' }], '20260101T000000Z');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('UID:task-1@jampack');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260810');
    expect(ics).toContain('SUMMARY:Relancer\\; client'); // ; échappé
    expect(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });
  it('calendrier vide reste valide', () => {
    const ics = buildAgendaIcs([]);
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });
});

describe('auditLogCsv', () => {
  it('en-tête + date/heure FR + échappement', () => {
    const csv = auditLogCsv([{ at: '2026-08-04T09:30:00Z', userEmail: 'a@b.fr', action: 'invoices.create', ref: 'FA-1' }]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Date;Utilisateur;Action;Référence');
    expect(lines[1]).toBe('04/08/2026 09:30;a@b.fr;invoices.create;FA-1');
  });
  it('référence absente → colonne vide ; liste vide → en-tête seul', () => {
    expect(auditLogCsv([{ at: '2026-08-04T00:00:00Z', userEmail: '—', action: 'x' }]).split('\n')[1]).toBe('04/08/2026 00:00;—;x;');
    expect(auditLogCsv([])).toBe('Date;Utilisateur;Action;Référence');
  });
});

describe('balanceCsv', () => {
  it('en-tête + montants FR à 2 décimales + solde', () => {
    const csv = balanceCsv([{ code: '411000', name: 'Clients', debit: 120, credit: 0, solde: 120 }, { code: '707000', name: 'Ventes', debit: 0, credit: 100, solde: -100 }]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Compte;Libellé;Débit;Crédit;Solde');
    expect(lines[1]).toBe('411000;Clients;120,00;0,00;120,00');
    expect(lines[2]).toBe('707000;Ventes;0,00;100,00;-100,00');
  });
  it('liste vide → en-tête seul', () => {
    expect(balanceCsv([])).toBe('Compte;Libellé;Débit;Crédit;Solde');
  });
});

describe('stockLevelsCsv', () => {
  it('génère un en-tête + lignes, décimale FR, et échappe le séparateur', () => {
    const csv = stockLevelsCsv([
      { reference: 'R1', productName: 'Baguette', warehouseName: 'Dépôt A', quantity: 65, unit: 'pièce' },
      { reference: null, productName: 'Pain; spécial', warehouseName: 'Dépôt B', quantity: 12.5, unit: null },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Référence;Article;Entrepôt;Quantité;Unité');
    expect(lines[1]).toBe('R1;Baguette;Dépôt A;65;pièce');
    expect(lines[2]).toBe(';"Pain; spécial";Dépôt B;12,5;'); // nom avec ; entre guillemets, réf/unité vides
  });
  it('liste vide → en-tête seul', () => {
    expect(stockLevelsCsv([])).toBe('Référence;Article;Entrepôt;Quantité;Unité');
  });
});

describe('parseProductsCsv', () => {
  it('parse réf ; nom ; prix ; unité ; type et ignore l’en-tête', () => {
    const csv = 'Référence;Nom;Prix HT;Unité;Type\nREF-1;Baguette;0,90;pièce;bien\nREF-2;Conseil;120,00;heure;service\n';
    const rows = parseProductsCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ reference: 'REF-1', name: 'Baguette', priceHt: 0.9, unit: 'pièce', kind: 'bien' });
    expect(rows[1].kind).toBe('service');
    expect(rows[1].priceHt).toBe(120);
  });
  it('nom obligatoire ; prix invalide → indéfini ; réf. facultative ; type par défaut bien', () => {
    const rows = parseProductsCsv(';;;;\nREF;Prix invalide;abc\n;Sans réf;12');
    expect(rows).toHaveLength(2); // la 1re ligne (sans nom) est ignorée
    expect(rows[0]).toEqual({ reference: 'REF', name: 'Prix invalide', priceHt: undefined, unit: undefined, kind: 'bien' });
    expect(rows[1]).toEqual({ reference: undefined, name: 'Sans réf', priceHt: 12, unit: undefined, kind: 'bien' });
  });
});

describe('stockTransfer', () => {
  it('accepte un transfert valide', () => {
    expect(stockTransfer.safeParse({ productId: 'p1', fromWarehouseId: 'w1', toWarehouseId: 'w2', quantity: 10 }).success).toBe(true);
  });
  it('rejette source = destination', () => {
    expect(stockTransfer.safeParse({ productId: 'p1', fromWarehouseId: 'w1', toWarehouseId: 'w1', quantity: 10 }).success).toBe(false);
  });
  it('rejette une quantité nulle ou négative', () => {
    expect(stockTransfer.safeParse({ productId: 'p1', fromWarehouseId: 'w1', toWarehouseId: 'w2', quantity: 0 }).success).toBe(false);
    expect(stockTransfer.safeParse({ productId: 'p1', fromWarehouseId: 'w1', toWarehouseId: 'w2', quantity: -5 }).success).toBe(false);
  });
});

describe('discountMention (escompte L441-10)', () => {
  it('sans condition → mention par défaut « néant »', () => {
    expect(discountMention()).toBe(DISCOUNT_MENTION_NONE);
    expect(discountMention('')).toBe(DISCOUNT_MENTION_NONE);
    expect(discountMention('   ')).toBe(DISCOUNT_MENTION_NONE);
  });
  it('avec condition → mention détaillée', () => {
    expect(discountMention('2 % sous 10 jours')).toBe('Escompte pour paiement anticipé : 2 % sous 10 jours');
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

describe('identifiants légaux FR (SIREN / SIRET / TVA intra)', () => {
  it('valide un SIREN (9 chiffres + clé de Luhn)', () => {
    expect(isValidSiren('732829320')).toBe(true);
    expect(isValidSiren('732 829 320')).toBe(true); // espaces tolérés
    expect(isValidSiren('732829321')).toBe(false);   // clé erronée
    expect(isValidSiren('12345')).toBe(false);        // longueur
    expect(isValidSiren(null)).toBe(false);
  });

  it('valide un SIRET (14 chiffres + clé de Luhn)', () => {
    expect(isValidSiret('73282932000074')).toBe(true);
    expect(isValidSiret('732829320')).toBe(false);   // c'est un SIREN, pas un SIRET
    expect(isValidSiret('73282932000075')).toBe(false); // clé erronée
  });

  it('calcule le n° de TVA intracommunautaire depuis le SIREN (règle DGFiP)', () => {
    // clé = (12 + 3 × (SIREN mod 97)) mod 97 ; 732829320 mod 97 = 43 → clé 44
    expect(frTvaNumber('732829320')).toBe('FR44732829320');
    expect(frTvaNumber('  732 829 320 ')).toBe('FR44732829320');
    expect(frTvaNumber('732829321')).toBeNull(); // SIREN invalide
    expect(frTvaNumber(null)).toBeNull();
  });
});

describe('coordonnées bancaires (IBAN / BIC)', () => {
  it('valide un IBAN par la clé mod-97', () => {
    expect(isValidIban('FR7630006000011234567890189')).toBe(true);
    expect(isValidIban('FR76 3000 6000 0112 3456 7890 189')).toBe(true); // espaces tolérés
    expect(isValidIban('FR7630006000011234567890188')).toBe(false);      // clé erronée
    expect(isValidIban('XX00')).toBe(false);                              // format
    expect(isValidIban(null)).toBe(false);
  });

  it('valide le format d\'un BIC', () => {
    expect(isValidBic('BNPAFRPP')).toBe(true);       // 8 caractères
    expect(isValidBic('BNPAFRPPXXX')).toBe(true);    // 11 caractères
    expect(isValidBic('BNPA')).toBe(false);
    expect(isValidBic('1234FRPP')).toBe(false);      // les 6 premiers doivent être des lettres
  });

  it('formate un IBAN par groupes de 4', () => {
    expect(formatIban('FR7630006000011234567890189')).toBe('FR76 3000 6000 0112 3456 7890 189');
    expect(formatIban('')).toBe('');
  });
});

describe('export CSV — grand livre', () => {
  it('sérialise un grand livre (en-tête, date FR, décimale FR, échappement)', () => {
    const csv = ledgerCsv([
      { date: new Date('2026-08-04T00:00:00Z'), journal: 'VT', reference: 'FA-0001', label: 'Vente; client A', debit: 120, credit: 0, letter: null, solde: 120 },
      { date: new Date('2026-08-05T00:00:00Z'), journal: 'BQ', reference: null, label: 'Encaissement', debit: 0, credit: 120, letter: 'AA', solde: 0 },
    ]);
    const [head, l1, l2] = csv.split('\n');
    expect(head).toBe('Date;Journal;Référence;Libellé;Débit;Crédit;Lettrage;Solde');
    expect(l1).toBe('04/08/2026;VT;FA-0001;"Vente; client A";120,00;0,00;;120,00');
    expect(l2).toBe('05/08/2026;BQ;;Encaissement;0,00;120,00;AA;0,00');
  });
});
