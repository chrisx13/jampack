import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { demoCaller, N } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;

beforeAll(async () => { C = await demoCaller(); caller = C.caller; });

afterAll(async () => {
  const { prisma, soc } = C;
  const base = await prisma.invoice.findMany({ where: { notes: { contains: '[INT]' } }, select: { id: true, journalEntryId: true } });
  // Pièces dérivées (avoirs générés depuis une facture [INT]) : leurs notes ne contiennent pas [INT].
  const derived = await prisma.invoice.findMany({ where: { sourceId: { in: base.map((i) => i.id) } }, select: { id: true, journalEntryId: true } });
  const all = [...base, ...derived];
  const invIds = all.map((i) => i.id);
  // Écritures liées : comptabilisation des factures + des règlements (avant suppression des factures).
  const pays = await prisma.payment.findMany({ where: { invoiceId: { in: invIds }, journalEntryId: { not: null } }, select: { journalEntryId: true } });
  const entryIds = [...all.map((i) => i.journalEntryId), ...pays.map((p) => p.journalEntryId)].filter((x): x is string => !!x);
  await prisma.invoice.deleteMany({ where: { id: { in: invIds } } }); // cascade payments + lignes
  await prisma.journalEntry.deleteMany({ where: { id: { in: entryIds } } }); // cascade lignes d'écriture
  await prisma.numberSequence.updateMany({ where: { societeId: soc.id, docType: { in: ['devis', 'facture', 'avoir'] } }, data: { nextValue: 1 } });
  // Le journal d'audit se remplit à chaque mutation des tests → on le vide (dernier fichier exécuté).
  await prisma.auditLog.deleteMany({});
});

async function anyCustomer() {
  return (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
}

describe('Ventes — chaîne devis → facture → avoir', () => {
  it('devis émis, accepté, converti en facture ; avoir depuis facture', async () => {
    const companyId = await anyCustomer();
    const devis = await caller.quotes.create({ companyId, notes: '[INT]', lines: [{ label: 'A', quantity: 3, unitPriceHt: 100, taxRatePct: 20 }, { label: 'B', quantity: 1, unitPriceHt: 50, taxRatePct: 5.5 }] });
    const sent = await caller.quotes.validate({ id: devis.id });
    expect(sent.number).toMatch(/^DE-/);
    expect(sent.status).toBe('sent');

    const accepted = await caller.quotes.accept({ id: devis.id });
    expect(accepted.status).toBe('accepted');

    const conv = await caller.quotes.convertToInvoice({ id: devis.id });
    const facture = await C.prisma.invoice.findUniqueOrThrow({ where: { id: conv.id } });
    expect(facture.docType).toBe('facture');
    expect(facture.sourceId).toBe(devis.id);
    expect((await C.prisma.invoice.findUniqueOrThrow({ where: { id: devis.id } })).status).toBe('converted');

    const inv = await caller.invoices.validate({ id: conv.id });
    expect(inv.number).toMatch(/^FA-/);
    expect(inv.status).toBe('validated');

    const cn = await caller.invoices.createCreditNote({ id: conv.id });
    const cnRow = await C.prisma.invoice.findUniqueOrThrow({ where: { id: cn.id } });
    expect(cnRow.docType).toBe('avoir');
    expect(cnRow.sourceId).toBe(conv.id);
    const cnv = await caller.creditNotes.validate({ id: cn.id });
    expect(cnv.number).toMatch(/^AV-/);
  });

  it('règlements : acompte puis solde → statut payée, échéancier cohérent', async () => {
    const companyId = await anyCustomer();
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'X', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });

    await caller.payments.create({ invoiceId: inv.id, amount: 50, method: 'virement' });
    expect((await C.prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe('validated');
    expect((await caller.payments.echeancier()).some((r: { id: string }) => r.id === inv.id)).toBe(true);

    await caller.payments.create({ invoiceId: inv.id, amount: 70, method: 'cheque' });
    expect((await C.prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe('paid');
    expect((await caller.payments.echeancier()).some((r: { id: string }) => r.id === inv.id)).toBe(false);
  });

  it('comptabilisation d’une facture : écriture 411/707/44571 équilibrée et idempotente', async () => {
    const companyId = await anyCustomer();
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'Y', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });

    const r = await caller.accounting.postSalesInvoice({ id: inv.id });
    expect(r.alreadyPosted).toBe(false);
    const entry = await C.prisma.journalEntry.findUniqueOrThrow({ where: { id: r.id }, include: { lines: { include: { account: true } } } });
    const debit = entry.lines.reduce((s, l) => s + N(l.debit), 0);
    const credit = entry.lines.reduce((s, l) => s + N(l.credit), 0);
    expect(debit).toBeCloseTo(credit, 2);
    expect(debit).toBeCloseTo(120, 2);
    expect(entry.lines.find((l) => l.account.code === '411000')!.debit + '').toContain('120');
    expect(N(entry.lines.find((l) => l.account.code === '445710')!.credit)).toBeCloseTo(20, 2);

    const r2 = await caller.accounting.postSalesInvoice({ id: inv.id });
    expect(r2.alreadyPosted).toBe(true);
    expect(r2.id).toBe(r.id);
  });

  it('comptabilisation d’un règlement : journal banque 512 débit = 411 crédit', async () => {
    const companyId = await anyCustomer();
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'Z', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });
    const pay = await caller.payments.create({ invoiceId: inv.id, amount: 120, method: 'virement' });
    const r = await caller.accounting.postPayment({ id: pay.id });
    expect(r.alreadyPosted).toBe(false);
    const entry = await C.prisma.journalEntry.findUniqueOrThrow({ where: { id: r.id }, include: { lines: { include: { account: true } } } });
    expect(N(entry.lines.find((l) => l.account.code === '512000')!.debit)).toBeCloseTo(120, 2);
    expect(N(entry.lines.find((l) => l.account.code === '411000')!.credit)).toBeCloseTo(120, 2);
    expect((await caller.accounting.postPayment({ id: pay.id })).alreadyPosted).toBe(true);
  });

  it('export FEC : entête normée + lignes d’écriture', async () => {
    const companyId = await anyCustomer();
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'W', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });
    await caller.accounting.postSalesInvoice({ id: inv.id });
    const fec = await caller.accounting.fec({});
    expect(fec.filename).toMatch(/\.txt$/);
    expect(fec.content.split('\r\n')[0]).toContain('JournalCode\tJournalLib\tEcritureNum');
    expect(fec.lines).toBeGreaterThanOrEqual(3);
    expect(fec.content).toContain('411000');
  });
});

describe('Comptabilité — déclaration de TVA (CA3)', () => {
  it('collectée/déductible reflètent les comptabilisations (Δ +20 / +40)', async () => {
    const before = await caller.accounting.vatReturn({});
    // Vente : TVA 20 collectée
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'V', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });
    await caller.accounting.postSalesInvoice({ id: inv.id });
    // Achat : TVA 40 déductible
    const sid = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isSupplier: true } })).id;
    const si = await caller.supplierInvoices.create({ supplierId: sid, reference: '[INT] TVA', notes: '[INT]', lines: [{ label: 'A', quantity: 1, unitPriceHt: 200, taxRatePct: 20 }] });
    await caller.supplierInvoices.validate({ id: si.id });
    await caller.accounting.postSupplierInvoice({ id: si.id });

    const after = await caller.accounting.vatReturn({});
    expect(after.collectee - before.collectee).toBeCloseTo(20, 2);
    expect(after.deductible - before.deductible).toBeCloseTo(40, 2);

    // Nettoyage de la facture fournisseur + son écriture (hors périmètre de l'afterAll ventes).
    const siRow = await C.prisma.supplierInvoice.findUniqueOrThrow({ where: { id: si.id } });
    await C.prisma.supplierInvoice.delete({ where: { id: si.id } });
    if (siRow.journalEntryId) await C.prisma.journalEntry.delete({ where: { id: siRow.journalEntryId } });
  });
});

describe('Audit — journalisation des mutations', () => {
  it('journalise chaque mutation (qui, quoi, référence)', async () => {
    const wh = await caller.stock.warehouses.create({ name: '[INT] Audit' });
    await caller.stock.warehouses.update({ id: wh.id, name: '[INT] Audit 2' });
    const logs = await caller.audit.list();
    expect(logs.some((l: { action: string }) => l.action === 'stock.warehouses.create')).toBe(true);
    const upd = logs.find((l: { action: string; ref: string | null }) => l.action === 'stock.warehouses.update' && l.ref === wh.id);
    expect(upd).toBeTruthy();
    expect(upd.userEmail).toContain('@');
    await C.prisma.warehouse.delete({ where: { id: wh.id } });
  });
});

describe('Analytics — synthèse financière', () => {
  it('CA facturé et encours clients reflètent une facture validée (Δ +120)', async () => {
    const before = await caller.analytics.summary();
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'S', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });
    const after = await caller.analytics.summary();
    expect(after.caFacture - before.caFacture).toBeCloseTo(120, 2);
    expect(after.encoursClients - before.encoursClients).toBeCloseTo(120, 2);
  });
});

describe('Comptabilité — lettrage', () => {
  it('lettre une facture et son règlement sur le compte client, puis délettre', async () => {
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    // Montant distinctif (TTC 164,40) pour isoler les lignes.
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'L', quantity: 1, unitPriceHt: 137, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });
    await caller.accounting.postSalesInvoice({ id: inv.id });
    const pay = await caller.payments.create({ invoiceId: inv.id, amount: 164.4, method: 'virement' });
    await caller.accounting.postPayment({ id: pay.id });

    const acc411 = (await C.prisma.account.findFirstOrThrow({ where: { societeId: C.soc.id, code: '411000' } })).id;
    const lines = await caller.accounting.accountLines({ accountId: acc411, onlyUnlettered: true });
    const debitLine = lines.find((l: { debit: number; letter: string | null }) => Math.abs(l.debit - 164.4) < 0.005 && !l.letter);
    const creditLine = lines.find((l: { credit: number; letter: string | null }) => Math.abs(l.credit - 164.4) < 0.005 && !l.letter);
    expect(debitLine && creditLine).toBeTruthy();

    const res = await caller.accounting.letter({ lineIds: [debitLine.id, creditLine.id] });
    expect(res.letter).toMatch(/^[A-Z]+$/);
    const afterL = await caller.accounting.accountLines({ accountId: acc411 });
    expect(afterL.find((l: { id: string }) => l.id === debitLine.id)?.letter).toBe(res.letter);

    // Refuse un lettrage déséquilibré
    await expect(caller.accounting.letter({ lineIds: [debitLine.id] })).rejects.toThrow();

    await caller.accounting.unletter({ letter: res.letter });
    const afterU = await caller.accounting.accountLines({ accountId: acc411 });
    expect(afterU.find((l: { id: string }) => l.id === debitLine.id)?.letter).toBeNull();
  });

  it('génère l’écriture de clôture de TVA (solde 44571/44566)', async () => {
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'v', quantity: 1, unitPriceHt: 120, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });
    await caller.accounting.postSalesInvoice({ id: inv.id }); // 44571 crédit 24
    const r = await caller.accounting.closeVat({});
    expect(r.id).toBeTruthy();
    const after = await caller.accounting.vatReturn({});
    expect(after.collectee).toBeCloseTo(0, 2);
    expect(after.deductible).toBeCloseTo(0, 2);
    // Nettoyage de l'écriture de clôture (les factures [INT] et leurs écritures sont nettoyées par afterAll).
    await C.prisma.journalEntryLine.deleteMany({ where: { entryId: r.id } });
    await C.prisma.journalEntry.delete({ where: { id: r.id } });
  });
});
