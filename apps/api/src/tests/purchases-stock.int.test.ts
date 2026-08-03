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
  const sis = await prisma.supplierInvoice.findMany({ where: { notes: { contains: '[INT]' } }, select: { id: true } });
  await prisma.supplierInvoice.deleteMany({ where: { id: { in: sis.map((s) => s.id) } } });
  await prisma.numberSequence.updateMany({ where: { societeId: soc.id, docType: 'commande' }, data: { nextValue: 1 } });
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
