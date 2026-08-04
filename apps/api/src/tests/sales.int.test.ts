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

    // Rapprochement bancaire : la ligne 512 apparaît, non pointée ; après pointage le reste diminue.
    const bank = await caller.accounting.bankLines();
    const line512 = bank.lines.find((l: { id: string; debit: number }) => l.debit === 120);
    expect(line512).toBeTruthy();
    expect(line512.reconciled).toBe(false);
    const before = bank.reconciledBalance;
    await caller.accounting.reconcile({ id: line512.id, reconciled: true });
    const after = await caller.accounting.bankLines();
    expect(after.reconciledBalance).toBeCloseTo(before + 120, 2);
    expect(after.lines.find((l: { id: string }) => l.id === line512.id).reconciled).toBe(true);
  });

  it('import de relevé bancaire : pointage automatique par montant', async () => {
    const companyId = await anyCustomer();
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'BR', quantity: 1, unitPriceHt: 77, taxRatePct: 0 }] });
    await caller.invoices.validate({ id: inv.id });
    const pay = await caller.payments.create({ invoiceId: inv.id, amount: 77, method: 'virement' });
    await caller.accounting.postPayment({ id: pay.id }); // 512 débit 77 (non pointé)
    const res = await caller.accounting.importBankStatement({ csv: '2026-08-04;Virement 77;77,00\n2026-08-04;Inconnu;999,99' });
    expect(res.parsed).toBe(2);
    expect(res.matched).toBe(1);
    expect(res.unmatched).toHaveLength(1);
    const bank = await caller.accounting.bankLines();
    expect(bank.lines.find((l: { debit: number; reconciled: boolean }) => l.debit === 77)?.reconciled).toBe(true);
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

describe('Comptabilité — grand livre', () => {
  it('liste les mouvements d’un compte avec solde progressif', async () => {
    const companyId = await anyCustomer();
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'GL', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });
    await caller.accounting.postSalesInvoice({ id: inv.id }); // 411 débit 120
    const acc411 = await C.prisma.account.findFirstOrThrow({ where: { societeId: C.soc.id, code: '411000' } });
    const gl = await caller.accounting.ledger({ accountId: acc411.id });
    expect(gl.account.code).toBe('411000');
    expect(gl.rows.length).toBeGreaterThanOrEqual(1);
    // Le solde progressif de la dernière ligne = total débit − total crédit.
    expect(gl.rows[gl.rows.length - 1].solde).toBeCloseTo(gl.totalDebit - gl.totalCredit, 2);
    expect(gl.totalDebit).toBeGreaterThanOrEqual(120);
  });
});

describe('Analytics — balance âgée clients', () => {
  it('ventile les créances par tranche d’ancienneté', async () => {
    const companyId = await anyCustomer();
    const day = 86400000;
    const overdue45 = new Date(Date.now() - 45 * day).toISOString().slice(0, 10);
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', dueDate: overdue45, lines: [{ label: 'AR', quantity: 1, unitPriceHt: 100, taxRatePct: 0 }] });
    await caller.invoices.validate({ id: inv.id });
    const aged = await caller.analytics.agedReceivables();
    // Le total de la tranche 31–60 j inclut au moins nos 100 € (facture à 45 j d'échéance).
    expect(aged.totals.d31_60).toBeGreaterThanOrEqual(100);
    expect(aged.rows.some((r: { company: string; d31_60: number }) => r.d31_60 >= 100)).toBe(true);
  });
});

describe('Comptabilité — immobilisations & amortissement', () => {
  it('plan d’amortissement linéaire (3000 € / 3 ans, 1er janvier → 1000/an)', async () => {
    const a = await caller.accounting.fixedAssets.create({ name: '[INT] Matériel', accountCode: '215000', amountHt: 3000, acquisitionDate: '2026-01-05', durationYears: 3 });
    const s = await caller.accounting.fixedAssets.schedule({ id: a.id });
    expect(s.rows).toHaveLength(3);
    expect(s.rows.map((r: { annuity: number }) => r.annuity)).toEqual([1000, 1000, 1000]);
    expect(s.rows[2].residual).toBe(0);

    // Comptabilisation de la dotation 2026 : 681 débit = 281 crédit (1000), idempotente.
    const post = await caller.accounting.fixedAssets.postDepreciation({ id: a.id, year: 2026 });
    expect(post.alreadyPosted).toBe(false);
    expect(post.annuity).toBeCloseTo(1000, 2);
    const entry = await C.prisma.journalEntry.findUniqueOrThrow({ where: { id: post.id }, include: { lines: { include: { account: true } } } });
    expect(N(entry.lines.find((l) => l.account.code === '681000')!.debit)).toBeCloseTo(1000, 2);
    expect(N(entry.lines.find((l) => l.account.code === '281800')!.credit)).toBeCloseTo(1000, 2);
    expect((await caller.accounting.fixedAssets.postDepreciation({ id: a.id, year: 2026 })).alreadyPosted).toBe(true);
    const sched2 = await caller.accounting.fixedAssets.schedule({ id: a.id });
    expect(sched2.rows.find((r: { year: number; posted: boolean }) => r.year === 2026)?.posted).toBe(true);

    // nettoyage écriture + immobilisation
    await C.prisma.journalEntryLine.deleteMany({ where: { entryId: post.id } });
    await C.prisma.journalEntry.delete({ where: { id: post.id } });
    await caller.accounting.fixedAssets.remove({ id: a.id });
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

describe('E-invoicing — Factur-X & PDP interne', () => {
  it('génère le XML CII (Factur-X) et transmet via la PDP interne', async () => {
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    // Identifiants légaux acheteur (REG-5 / e-invoicing B2B) : SIREN (routage) + TVA.
    await caller.crm.companies.update({ id: companyId, siren: '552081317', tvaNumber: 'FR89552081317' });
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'e', quantity: 2, unitPriceHt: 50, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: inv.id });

    const fx = await caller.invoices.facturx({ id: inv.id });
    expect(fx.filename).toMatch(/facturx\.xml$/);
    expect(fx.xml).toContain('<rsm:CrossIndustryInvoice');
    expect(fx.xml).toContain('urn:cen.eu:en16931:2017');
    expect(fx.xml).toContain('<ram:GrandTotalAmount>120.00</ram:GrandTotalAmount>');
    // BuyerTradeParty porte le SIREN (schemeID 0002) et le n° de TVA (schemeID VA).
    const buyer = fx.xml.slice(fx.xml.indexOf('<ram:BuyerTradeParty>'));
    expect(buyer).toContain('schemeID="0002">552081317</ram:ID>');
    expect(buyer).toContain('schemeID="VA">FR89552081317</ram:ID>');

    const res = await caller.invoices.sendToPdp({ id: inv.id });
    expect(res.provider).toBe('internal');
    expect(res.status).toBe('accepted');
    const tx = await caller.invoices.transmissions({ id: inv.id });
    expect(tx).toHaveLength(1);
    expect(tx[0].providerRef).toContain('INT-');
  });

  it('autoliquidation : mention 283-2 → catégorie « AE » dans le Factur-X', async () => {
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    const inv = await caller.invoices.create({ companyId, notes: '[INT]', vatReverseCharge: true, lines: [{ label: 'a', quantity: 1, unitPriceHt: 200, taxRatePct: 0 }] });
    await caller.invoices.validate({ id: inv.id });
    const fx = await caller.invoices.facturx({ id: inv.id });
    expect(fx.xml).toContain('<ram:CategoryCode>AE</ram:CategoryCode>');
    expect(fx.xml).toContain('Autoliquidation');
    expect(fx.xml).not.toContain('<ram:CategoryCode>S</ram:CategoryCode>');
  });

  it('franchise en base de TVA : mention 293 B → catégorie d’exonération « E » dans le Factur-X', async () => {
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    await caller.societes.updateSettings({ vatFranchise: true });
    try {
      const inv = await caller.invoices.create({ companyId, notes: '[INT]', lines: [{ label: 'f', quantity: 1, unitPriceHt: 100, taxRatePct: 0 }] });
      await caller.invoices.validate({ id: inv.id });
      const fx = await caller.invoices.facturx({ id: inv.id });
      expect(fx.xml).toContain('<ram:CategoryCode>E</ram:CategoryCode>');
      expect(fx.xml).toContain('293 B du CGI');
      expect(fx.xml).not.toContain('<ram:CategoryCode>S</ram:CategoryCode>');
    } finally {
      await caller.societes.updateSettings({ vatFranchise: false });
    }
  });
});

describe('CRM — RGPD (opposition & export des données)', () => {
  it('drapeau « ne pas prospecter » + export des données personnelles', async () => {
    const co = await caller.crm.companies.create({ name: '[INT] RGPD SARL', siren: '123456789', doNotProspect: true });
    await caller.crm.contacts.create({ companyId: co.id, firstName: 'Jean', lastName: 'Test', email: 'jean@int-rgpd.fr' });
    const exp = await caller.crm.companies.exportData({ id: co.id });
    expect(exp.subject.name).toBe('[INT] RGPD SARL');
    expect(exp.subject.doNotProspect).toBe(true);
    expect(exp.contacts.some((c: { email: string | null }) => c.email === 'jean@int-rgpd.fr')).toBe(true);
    await caller.crm.companies.remove({ id: co.id }); // nettoyage (contact détaché puis société supprimée)
    await C.prisma.contact.deleteMany({ where: { email: 'jean@int-rgpd.fr' } });
  });

  it('effacement anonymisant (art. 17) : identité et contacts neutralisés', async () => {
    const co = await caller.crm.companies.create({ name: '[INT] À anonymiser', siren: '987654321', siret: '98765432100011', tvaNumber: 'FR00987654321' });
    await caller.crm.contacts.create({ companyId: co.id, firstName: 'Marie', lastName: 'Perso', email: 'marie@int-anon.fr', phone: '0102030405' });
    await caller.crm.companies.anonymize({ id: co.id });
    const after = await C.prisma.company.findUniqueOrThrow({ where: { id: co.id }, include: { contacts: true } });
    expect(after.name).toBe('Client anonymisé');
    expect(after.siren).toBeNull();
    expect(after.tvaNumber).toBeNull();
    expect(after.doNotProspect).toBe(true);
    expect(after.contacts.every((c) => c.email === null && c.lastName === 'anonymisé')).toBe(true);
    // nettoyage
    await C.prisma.contact.deleteMany({ where: { companyId: co.id } });
    await C.prisma.company.delete({ where: { id: co.id } });
  });

  it('candidats à la purge : tiers sans activité depuis > 3 ans', async () => {
    const co = await caller.crm.companies.create({ name: '[INT] Dormant' });
    // Backdate l'activité à 4 ans (updatedAt est géré par Prisma → SQL direct).
    await C.prisma.$executeRawUnsafe(`UPDATE "Company" SET "updatedAt" = now() - interval '4 years' WHERE id = $1`, co.id);
    const cands = await caller.crm.companies.purgeCandidates();
    expect(cands.some((c: { id: string }) => c.id === co.id)).toBe(true);
    // Un tiers récent n'apparaît pas.
    const recent = await caller.crm.companies.create({ name: '[INT] Récent' });
    expect((await caller.crm.companies.purgeCandidates()).some((c: { id: string }) => c.id === recent.id)).toBe(false);
    await C.prisma.company.deleteMany({ where: { id: { in: [co.id, recent.id] } } });
  });

  it('limitation du traitement (art. 18) : bloque toute nouvelle pièce', async () => {
    const co = await caller.crm.companies.create({ name: '[INT] Limité', processingRestricted: true });
    await expect(caller.invoices.create({ companyId: co.id, notes: '[INT]', lines: [{ label: 'x', quantity: 1, unitPriceHt: 10, taxRatePct: 20 }] })).rejects.toThrow(/limité/i);
    // levée de la limitation → création à nouveau possible
    await caller.crm.companies.update({ id: co.id, processingRestricted: false });
    const inv = await caller.invoices.create({ companyId: co.id, notes: '[INT]', lines: [{ label: 'x', quantity: 1, unitPriceHt: 10, taxRatePct: 20 }] });
    expect(inv.id).toBeTruthy();
    await C.prisma.invoice.deleteMany({ where: { companyId: co.id } });
    await C.prisma.company.delete({ where: { id: co.id } });
  });
});
