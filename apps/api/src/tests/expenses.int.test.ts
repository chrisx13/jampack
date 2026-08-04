import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;
const ids: string[] = [];
let entryId: string | null = null;

beforeAll(async () => { C = await demoCaller(); caller = C.caller; });
afterAll(async () => {
  await C.prisma.expense.deleteMany({ where: { id: { in: ids } } });
  if (entryId) await C.prisma.journalEntry.deleteMany({ where: { id: entryId } });
});

describe('Notes de frais', () => {
  it('création → validation → comptabilisation équilibrée (6xx + 44566 = 421)', async () => {
    const e = await caller.expenses.create({ date: new Date().toISOString().slice(0, 10), category: 'repas', description: 'Déjeuner client [INT]', amountHt: 50, taxRatePct: 10 });
    ids.push(e.id);
    // TTC = 55 ; TVA = 5.
    const row = (await caller.expenses.list()).find((x: { id: string }) => x.id === e.id);
    expect(row.ttc).toBeCloseTo(55, 2);
    expect(row.categoryLabel).toContain('Repas');

    await caller.expenses.validate({ id: e.id });
    const posted = await caller.expenses.post({ id: e.id });
    entryId = posted.id;
    expect(posted.alreadyPosted).toBe(false);

    // Écriture équilibrée : charge 50 + TVA 5 au débit = 55 au crédit (421).
    const entry = await C.prisma.journalEntry.findUniqueOrThrow({ where: { id: posted.id }, include: { lines: true } });
    const debit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(debit).toBeCloseTo(55, 2);
    expect(credit).toBeCloseTo(55, 2);

    // Idempotent.
    const again = await caller.expenses.post({ id: e.id });
    expect(again.alreadyPosted).toBe(true);
  });
});
