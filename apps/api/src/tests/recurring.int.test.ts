import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;
const tplIds: string[] = [];
const invIds: string[] = [];

beforeAll(async () => { C = await demoCaller(); caller = C.caller; });
afterAll(async () => {
  await C.prisma.invoice.deleteMany({ where: { id: { in: invIds } } });
  await C.prisma.recurringInvoice.deleteMany({ where: { id: { in: tplIds } } });
});

describe('Factures récurrentes (abonnements)', () => {
  it('génère une facture brouillon à échéance et avance la prochaine échéance', async () => {
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    const past = new Date(Date.now() - 5 * 86400000).toISOString(); // échéance dépassée
    const tpl = await caller.recurring.create({
      companyId, label: 'Maintenance mensuelle', frequency: 'monthly', interval: 1,
      nextRunAt: past, active: true, discountType: 'none', discountValue: 0,
      lines: [{ label: 'Abonnement', quantity: 1, unitPriceHt: 100, taxRatePct: 20 }],
    });
    tplIds.push(tpl.id);

    const res = await caller.recurring.generateDue();
    expect(res.generated).toBeGreaterThanOrEqual(1);

    // Récupère la/les factures générées pour ce client (notes « Abonnement : … »).
    const gen = await C.prisma.invoice.findMany({ where: { companyId, notes: { contains: 'Maintenance mensuelle' } } });
    invIds.push(...gen.map((g) => g.id));
    expect(gen.length).toBeGreaterThanOrEqual(1);
    expect(gen[0].status).toBe('draft');

    // L'échéance a été avancée dans le futur.
    const after = await C.prisma.recurringInvoice.findUniqueOrThrow({ where: { id: tpl.id } });
    expect(new Date(after.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('duplique un abonnement (copie suspendue, libellé suffixé)', async () => {
    const companyId = (await C.prisma.company.findFirstOrThrow({ where: { societeId: C.soc.id, isCustomer: true } })).id;
    const tpl = await caller.recurring.create({ companyId, label: 'Hébergement', frequency: 'yearly', interval: 1, nextRunAt: new Date().toISOString(), active: true, discountType: 'none', discountValue: 0, lines: [{ label: 'Hosting', quantity: 1, unitPriceHt: 200, taxRatePct: 20 }] });
    tplIds.push(tpl.id);
    const copy = await caller.recurring.duplicate({ id: tpl.id });
    tplIds.push(copy.id);
    expect(copy.id).not.toBe(tpl.id);
    expect(copy.label).toBe('Hébergement (copie)');
    expect(copy.active).toBe(false);
    expect(copy.companyId).toBe(companyId);
  });
});
