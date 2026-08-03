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

      // Achats : encours fournisseurs (factures fournisseurs validées)
      const sis = await tx.supplierInvoice.findMany({ where: { ...scope(ctx.societeId), status: 'validated' }, include: { lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } } } });
      const encoursFournisseurs = sis.reduce((s, si) => s + totalsOf(si.lines).totalTtc, 0);

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
});
