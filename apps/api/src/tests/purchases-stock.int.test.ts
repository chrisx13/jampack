import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { demoCaller, N } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;

beforeAll(async () => { C = await demoCaller(); caller = C.caller; });

afterAll(async () => {
  const { prisma, soc } = C;
  const whs = await prisma.warehouse.findMany({ where: { name: { contains: '[INT]' } }, select: { id: true } });
  const whIds = whs.map((w) => w.id);
  await prisma.stockMovement.deleteMany({ where: { warehouseId: { in: whIds } } });
  const pos = await prisma.purchaseOrder.findMany({ where: { notes: { contains: '[INT]' } }, select: { id: true } });
  await prisma.purchaseOrder.deleteMany({ where: { id: { in: pos.map((p) => p.id) } } });
  await prisma.product.deleteMany({ where: { name: { contains: '[INT]' } } });
  await prisma.warehouse.deleteMany({ where: { id: { in: whIds } } });
  const sis = await prisma.supplierInvoice.findMany({ where: { notes: { contains: '[INT]' } }, select: { id: true, journalEntryId: true } });
  const spays = await prisma.supplierPayment.findMany({ where: { supplierInvoiceId: { in: sis.map((s) => s.id) } }, select: { journalEntryId: true } });
  await prisma.supplierInvoice.deleteMany({ where: { id: { in: sis.map((s) => s.id) } } }); // cascade des règlements fournisseurs
  const jeIds = [...sis.map((s) => s.journalEntryId), ...spays.map((s) => s.journalEntryId)].filter((x): x is string => !!x);
  await prisma.journalEntry.deleteMany({ where: { id: { in: jeIds } } });
  // Écritures de règlement dont la pièce n'existe plus (règlement supprimé) : balayage par référence.
  await prisma.journalEntry.deleteMany({ where: { societeId: soc.id, reference: { contains: '[INT]' } } });
  await prisma.numberSequence.updateMany({ where: { societeId: soc.id, docType: 'commande' }, data: { nextValue: 1 } });
  await prisma.auditLog.deleteMany({});
});

const product = async () => (await C.prisma.product.findFirstOrThrow({ where: { societeId: C.soc.id, name: 'Baguette tradition' } })).id;
const supplier = async () => (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isSupplier: true } })).id;

describe('Stock — mouvements, niveaux, valorisation', () => {
  it('niveau net = somme signée des mouvements', async () => {
    const pid = await product();
    const wh = await caller.stock.warehouses.create({ name: '[INT] Niveaux' });
    await caller.stock.movements.create({ warehouseId: wh.id, productId: pid, kind: 'entree', quantity: 100, unitCost: 2 });
    await caller.stock.movements.create({ warehouseId: wh.id, productId: pid, kind: 'sortie', quantity: 30 });
    await caller.stock.movements.create({ warehouseId: wh.id, productId: pid, kind: 'ajustement', quantity: -5 });
    const lvl = (await caller.stock.levels()).find((l: { productId: string; warehouseId: string; quantity: number }) => l.productId === pid && l.warehouseId === wh.id);
    expect(lvl.quantity).toBeCloseTo(65, 3);
    const mv = await caller.stock.movements.list({ warehouseId: wh.id });
    expect(mv).toHaveLength(3);
    expect(mv.some((m: { kind: string; quantity: unknown }) => m.kind === 'sortie' && N(m.quantity) === -30)).toBe(true);
  });

  it('valorisation au PMP (article isolé : PMP=3, valeur=600)', async () => {
    // Article neuf sans stock antérieur → PMP et valeur déterministes.
    const p = await caller.catalog.products.create({ name: '[INT] Valo Prod', kind: 'bien' });
    const wh = await caller.stock.warehouses.create({ name: '[INT] Valo' });
    await caller.stock.movements.create({ warehouseId: wh.id, productId: p.id, kind: 'entree', quantity: 100, unitCost: 2 });
    await caller.stock.movements.create({ warehouseId: wh.id, productId: p.id, kind: 'entree', quantity: 100, unitCost: 4 });
    const row = (await caller.stock.valuation()).rows.find((r: { productId: string }) => r.productId === p.id);
    expect(row.quantity).toBeCloseTo(200, 3);
    expect(row.pmp).toBeCloseTo(3, 2);
    expect(row.value).toBeCloseTo(600, 2);
  });

  it('inventaire : aligne le niveau sur la quantité comptée via un ajustement', async () => {
    const p = await caller.catalog.products.create({ name: '[INT] Inv Prod', kind: 'bien' });
    const wh = await caller.stock.warehouses.create({ name: '[INT] Inv' });
    await caller.stock.movements.create({ warehouseId: wh.id, productId: p.id, kind: 'entree', quantity: 50 });
    const res = await caller.stock.inventory({ warehouseId: wh.id, productId: p.id, countedQuantity: 30 });
    expect(res.delta).toBeCloseTo(-20, 3);
    const lvl = (await caller.stock.levels()).find((l: { productId: string; warehouseId: string; quantity: number }) => l.productId === p.id && l.warehouseId === wh.id);
    expect(lvl.quantity).toBeCloseTo(30, 3);
    // idempotence : recompter la même quantité ne crée aucun mouvement
    expect((await caller.stock.inventory({ warehouseId: wh.id, productId: p.id, countedQuantity: 30 })).movementId).toBeNull();
  });

  it('seuil de réapprovisionnement : article sous le seuil listé dans lowStock', async () => {
    const p = await caller.catalog.products.create({ name: '[INT] Seuil Prod', kind: 'bien', reorderPoint: 100 });
    const wh = await caller.stock.warehouses.create({ name: '[INT] Seuil' });
    await caller.stock.movements.create({ warehouseId: wh.id, productId: p.id, kind: 'entree', quantity: 40 });
    const low = (await caller.stock.lowStock()).find((r: { productId: string; manque: number }) => r.productId === p.id);
    expect(low).toBeTruthy();
    expect(low.manque).toBeCloseTo(60, 3);
    // au-dessus du seuil → disparaît
    await caller.stock.movements.create({ warehouseId: wh.id, productId: p.id, kind: 'entree', quantity: 70 });
    expect((await caller.stock.lowStock()).some((r: { productId: string }) => r.productId === p.id)).toBe(false);
  });
});

describe('Achats — commande → réception → stock ; factures fournisseurs', () => {
  it('réception d’une commande alimente le stock', async () => {
    const [pid, sid] = [await product(), await supplier()];
    const wh = await caller.stock.warehouses.create({ name: '[INT] Récep' });
    const before = ((await caller.stock.levels()).find((l: { productId: string; warehouseId: string; quantity: number }) => l.productId === pid && l.warehouseId === wh.id)?.quantity) ?? 0;
    const po = await caller.purchases.orders.create({ supplierId: sid, warehouseId: wh.id, notes: '[INT]', lines: [{ productId: pid, label: 'Baguette', quantity: 200, unitPriceHt: 0.5 }] });
    const sent = await caller.purchases.orders.validate({ id: po.id });
    expect(sent.number).toMatch(/^CM-/);
    const received = await caller.purchases.orders.receive({ id: po.id });
    expect(received.status).toBe('received');
    const after = ((await caller.stock.levels()).find((l: { productId: string; warehouseId: string; quantity: number }) => l.productId === pid && l.warehouseId === wh.id)?.quantity) ?? 0;
    expect(after - before).toBeCloseTo(200, 3);
  });

  it('facture fournisseur : validée → échéancier, payée → hors échéancier', async () => {
    const sid = await supplier();
    const inv = await caller.supplierInvoices.create({ supplierId: sid, reference: '[INT] F', notes: '[INT]', dueDate: '2026-09-01', lines: [{ label: 'Marchandises', quantity: 1, unitPriceHt: 200, taxRatePct: 20 }] });
    await caller.supplierInvoices.validate({ id: inv.id });
    expect((await caller.supplierInvoices.echeancier()).some((r: { id: string }) => r.id === inv.id)).toBe(true);
    await caller.supplierInvoices.markPaid({ id: inv.id });
    expect((await caller.supplierInvoices.echeancier()).some((r: { id: string }) => r.id === inv.id)).toBe(false);
    const row = (await caller.supplierInvoices.list()).find((r: { id: string; totalTtc: number }) => r.id === inv.id);
    expect(row.totalTtc).toBeCloseTo(240, 2);
  });

  it('comptabilisation d’une facture fournisseur : journal achat (607+44566 = 401), équilibrée & idempotente', async () => {
    const sid = await supplier();
    const inv = await caller.supplierInvoices.create({ supplierId: sid, reference: '[INT] FC', notes: '[INT]', lines: [{ label: 'Achat', quantity: 1, unitPriceHt: 200, taxRatePct: 20 }] });
    await caller.supplierInvoices.validate({ id: inv.id });
    const r = await caller.accounting.postSupplierInvoice({ id: inv.id });
    expect(r.alreadyPosted).toBe(false);
    const entry = await C.prisma.journalEntry.findUniqueOrThrow({ where: { id: r.id }, include: { lines: { include: { account: true } } } });
    const debit = entry.lines.reduce((s, l) => s + N(l.debit), 0);
    const credit = entry.lines.reduce((s, l) => s + N(l.credit), 0);
    expect(debit).toBeCloseTo(credit, 2);
    expect(N(entry.lines.find((l) => l.account.code === '401000')!.credit)).toBeCloseTo(240, 2);
    expect(N(entry.lines.find((l) => l.account.code === '445660')!.debit)).toBeCloseTo(40, 2);
    expect((await caller.accounting.postSupplierInvoice({ id: inv.id })).alreadyPosted).toBe(true);
  });

  it('règlements fournisseurs partiels : reste dû dans l’échéancier, soldée hors échéancier, écriture 401=512', async () => {
    const sid = await supplier();
    const inv = await caller.supplierInvoices.create({ supplierId: sid, reference: '[INT] FP', notes: '[INT]', dueDate: '2026-09-01', lines: [{ label: 'Achat', quantity: 1, unitPriceHt: 200, taxRatePct: 20 }] });
    await caller.supplierInvoices.validate({ id: inv.id }); // TTC = 240

    // Acompte partiel → reste dû 140, toujours dans l'échéancier.
    const p1 = await caller.supplierPayments.create({ supplierInvoiceId: inv.id, amount: 100, method: 'virement' });
    const ech1 = (await caller.supplierInvoices.echeancier()).find((r: { id: string; remaining: number }) => r.id === inv.id);
    expect(ech1.remaining).toBeCloseTo(140, 2);
    expect((await caller.supplierInvoices.get({ id: inv.id })).status).toBe('validated');

    // Comptabilisation du règlement : 401 débit = 512 crédit, équilibrée & idempotente.
    const post = await caller.accounting.postSupplierPayment({ id: p1.id });
    expect(post.alreadyPosted).toBe(false);
    const entry = await C.prisma.journalEntry.findUniqueOrThrow({ where: { id: post.id }, include: { lines: { include: { account: true } } } });
    expect(N(entry.lines.find((l) => l.account.code === '401000')!.debit)).toBeCloseTo(100, 2);
    expect(N(entry.lines.find((l) => l.account.code === '512000')!.credit)).toBeCloseTo(100, 2);
    expect((await caller.accounting.postSupplierPayment({ id: p1.id })).alreadyPosted).toBe(true);

    // Solde → facture payée, hors échéancier.
    await caller.supplierPayments.create({ supplierInvoiceId: inv.id, amount: 140, method: 'cheque' });
    expect((await caller.supplierInvoices.get({ id: inv.id })).status).toBe('paid');
    expect((await caller.supplierInvoices.echeancier()).some((r: { id: string }) => r.id === inv.id)).toBe(false);

    // Suppression d'un règlement → repasse en validée (reste dû > 0).
    await caller.supplierPayments.remove({ id: p1.id });
    expect((await caller.supplierInvoices.get({ id: inv.id })).status).toBe('validated');
    expect((await caller.supplierPayments.listForInvoice({ supplierInvoiceId: inv.id }))).toHaveLength(1);
  });
});

describe('Trésorerie — prévisionnel encaissements vs décaissements', () => {
  it('agrège le reste dû clients (encaissements) et fournisseurs (décaissements)', async () => {
    const sid = await supplier();
    const cid = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;

    // Facture fournisseur 240, acompte 100 → reste 140 (décaissement attendu).
    const si = await caller.supplierInvoices.create({ supplierId: sid, reference: '[INT] TR', notes: '[INT]', lines: [{ label: 'Achat', quantity: 1, unitPriceHt: 200, taxRatePct: 20 }] });
    await caller.supplierInvoices.validate({ id: si.id });
    await caller.supplierPayments.create({ supplierInvoiceId: si.id, amount: 100, method: 'virement' });

    // Facture client 120, non réglée → encaissement attendu 120.
    const ci = await caller.invoices.create({ companyId: cid, notes: '[INT]', lines: [{ label: 'Vente', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }] });
    await caller.invoices.validate({ id: ci.id });

    const t = await caller.analytics.tresorerie();
    expect(t.decaissements.find((r: { id: string; amount: number }) => r.id === si.id)?.amount).toBeCloseTo(140, 2);
    expect(t.encaissements.find((r: { id: string; amount: number }) => r.id === ci.id)?.amount).toBeCloseTo(120, 2);
    expect(t.net).toBeCloseTo(Math.round((t.toReceive - t.toPay) * 100) / 100, 2);

    // Nettoyage de la facture client (le fournisseur est nettoyé par l'afterAll).
    await C.prisma.payment.deleteMany({ where: { invoiceId: ci.id } });
    await C.prisma.invoice.delete({ where: { id: ci.id } });
  });
});

describe('Comptabilité — écriture équilibrée & rejet du déséquilibre', () => {
  it('crée une écriture équilibrée et rejette un déséquilibre', async () => {
    const acc = async (code: string) => (await C.prisma.account.findFirstOrThrow({ where: { societeId: C.soc.id, code } })).id;
    const vt = await C.prisma.journal.findFirstOrThrow({ where: { societeId: C.soc.id, code: 'VT' } });
    const [cli, vte, tva] = [await acc('411000'), await acc('707000'), await acc('445710')];
    const e = await caller.accounting.entries.create({ journalId: vt.id, date: '2026-08-03', reference: '[INT]', label: '[INT] vente', lines: [{ accountId: cli, debit: 120, credit: 0 }, { accountId: vte, debit: 0, credit: 100 }, { accountId: tva, debit: 0, credit: 20 }] });
    expect(e.id).toBeTruthy();
    await expect(caller.accounting.entries.create({ journalId: vt.id, date: '2026-08-03', label: 'x', lines: [{ accountId: cli, debit: 120, credit: 0 }, { accountId: vte, debit: 0, credit: 100 }] })).rejects.toThrow();
    // nettoyage écriture
    await C.prisma.journalEntryLine.deleteMany({ where: { entryId: e.id } });
    await C.prisma.journalEntry.delete({ where: { id: e.id } });
  });
});
