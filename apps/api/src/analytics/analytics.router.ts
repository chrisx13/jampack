import { withTenant } from '@jampack/db';
import { computeInvoiceTotals } from '@jampack/domain';
import { router, protectedProcedure } from '../trpc/trpc';

const scope = (s: string | null) => (s ? { societeId: s } : {});
const n = (v: unknown) => Number(v as never);
const r2 = (v: number) => Math.round(v * 100) / 100;
const totalsOf = (lines: { quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown }[]) =>
  computeInvoiceTotals(lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));

export const analyticsRouter = router({
  /** KPI financiers consolidés de la société active (CA, encours, stock, TVA). */
  summary: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      // Ventes : CA facturé + encours clients (factures validées non soldées)
      const factures = await tx.invoice.findMany({
        where: { ...scope(ctx.societeId), docType: 'facture', status: { in: ['validated', 'paid'] } },
        include: { lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } }, payments: { select: { amount: true } } },
      });
      let caFacture = 0, encoursClients = 0;
      for (const f of factures) {
        const t = totalsOf(f.lines);
        caFacture += t.totalTtc;
        if (f.status === 'validated') {
          const paid = f.payments.reduce((s, p) => s + n(p.amount), 0);
          encoursClients += Math.max(0, t.totalTtc - paid);
        }
      }

      // Achats : encours fournisseurs (factures fournisseurs validées, net des règlements)
      const sis = await tx.supplierInvoice.findMany({ where: { ...scope(ctx.societeId), status: 'validated' }, include: { lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } }, payments: { select: { amount: true } } } });
      const encoursFournisseurs = sis.reduce((s, si) => {
        const paid = si.payments.reduce((a, p) => a + n(p.amount), 0);
        return s + Math.max(0, totalsOf(si.lines).totalTtc - paid);
      }, 0);

      // Stock : valeur au PMP
      const movements = await tx.stockMovement.findMany({ where: scope(ctx.societeId), select: { productId: true, quantity: true, kind: true, unitCost: true } });
      const agg = new Map<string, { qty: number; eq: number; ev: number }>();
      for (const m of movements) {
        const e = agg.get(m.productId) ?? { qty: 0, eq: 0, ev: 0 };
        e.qty += n(m.quantity);
        if (m.kind === 'entree' && m.unitCost != null) { e.eq += n(m.quantity); e.ev += n(m.quantity) * n(m.unitCost); }
        agg.set(m.productId, e);
      }
      let valeurStock = 0;
      for (const e of agg.values()) valeurStock += e.qty * (e.eq > 0 ? e.ev / e.eq : 0);

      // TVA : à décaisser (44571 collectée − 44566 déductible)
      const tvaAccs = await tx.account.findMany({ where: { ...scope(ctx.societeId), code: { in: ['445710', '445660'] } }, select: { id: true, code: true } });
      const sumAcc = async (code: string) => {
        const a = tvaAccs.find((x) => x.code === code);
        if (!a) return { d: 0, c: 0 };
        const g = await tx.journalEntryLine.aggregate({ where: { accountId: a.id, entry: { is: scope(ctx.societeId) } }, _sum: { debit: true, credit: true } });
        return { d: n(g._sum.debit), c: n(g._sum.credit) };
      };
      const col = await sumAcc('445710'); const ded = await sumAcc('445660');
      const tvaAPayer = r2((col.c - col.d) - (ded.d - ded.c));

      return {
        caFacture: r2(caFacture),
        encoursClients: r2(encoursClients),
        encoursFournisseurs: r2(encoursFournisseurs),
        valeurStock: r2(valeurStock),
        tvaAPayer,
      };
    })
  ),

  /** Prévisionnel de trésorerie : encaissements clients attendus vs décaissements fournisseurs, reste dû et retard. */
  tresorerie: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const now = Date.now();
      const remainingOf = (
        lines: { quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown }[],
        payments: { amount: unknown }[]
      ) => r2(totalsOf(lines).totalTtc - payments.reduce((s, p) => s + n(p.amount), 0));

      // Encaissements attendus : factures clients validées non soldées.
      const factures = await tx.invoice.findMany({
        where: { ...scope(ctx.societeId), docType: 'facture', status: 'validated' },
        include: { company: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } }, payments: { select: { amount: true } } },
        orderBy: [{ dueDate: 'asc' }],
      });
      const encaissements = factures
        .map((f) => ({ id: f.id, number: f.number, party: f.company?.name ?? '—', dueDate: f.dueDate, amount: remainingOf(f.lines, f.payments), overdue: f.dueDate ? new Date(f.dueDate).getTime() < now : false }))
        .filter((r) => r.amount > 0.005);

      // Décaissements attendus : factures fournisseurs validées non soldées.
      const sis = await tx.supplierInvoice.findMany({
        where: { ...scope(ctx.societeId), status: 'validated' },
        include: { supplier: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } }, payments: { select: { amount: true } } },
        orderBy: [{ dueDate: 'asc' }],
      });
      const decaissements = sis
        .map((s) => ({ id: s.id, number: s.reference, party: s.supplier?.name ?? '—', dueDate: s.dueDate, amount: remainingOf(s.lines, s.payments), overdue: s.dueDate ? new Date(s.dueDate).getTime() < now : false }))
        .filter((r) => r.amount > 0.005);

      const toReceive = r2(encaissements.reduce((s, r) => s + r.amount, 0));
      const toPay = r2(decaissements.reduce((s, r) => s + r.amount, 0));
      return { encaissements, decaissements, toReceive, toPay, net: r2(toReceive - toPay) };
    })
  ),

  /** Balance âgée clients : créances non soldées ventilées par tranche d'ancienneté (échéance dépassée). */
  agedReceivables: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const now = Date.now();
      const factures = await tx.invoice.findMany({
        where: { ...scope(ctx.societeId), docType: 'facture', status: 'validated' },
        include: { company: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } }, payments: { select: { amount: true } } },
      });
      type Bucket = { notDue: number; d1_30: number; d31_60: number; d61_90: number; d90p: number; total: number };
      const empty = (): Bucket => ({ notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, total: 0 });
      const byCompany = new Map<string, Bucket>();
      const totals = empty();
      for (const f of factures) {
        const remaining = totalsOf(f.lines).totalTtc - f.payments.reduce((s, p) => s + n(p.amount), 0);
        if (remaining <= 0.005) continue;
        const days = f.dueDate ? Math.floor((now - new Date(f.dueDate).getTime()) / 86400000) : -1;
        const bucket: keyof Bucket = days <= 0 ? 'notDue' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90p';
        const name = f.company?.name ?? '—';
        const b = byCompany.get(name) ?? empty();
        b[bucket] += remaining; b.total += remaining;
        totals[bucket] += remaining; totals.total += remaining;
        byCompany.set(name, b);
      }
      const round = (b: Bucket): Bucket => ({ notDue: r2(b.notDue), d1_30: r2(b.d1_30), d31_60: r2(b.d31_60), d61_90: r2(b.d61_90), d90p: r2(b.d90p), total: r2(b.total) });
      const rows = [...byCompany.entries()].map(([company, b]) => ({ company, ...round(b) })).sort((a, b) => b.total - a.total);
      return { rows, totals: round(totals) };
    })
  ),
});
