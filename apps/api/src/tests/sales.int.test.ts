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
