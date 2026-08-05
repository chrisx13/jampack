import { withTenant } from '@jampack/db';
import { recurringCreate, recurringUpdate, byId, nextOccurrence, type RecurrenceFrequency } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';
import { requireSociete, scope } from './salesRouter';

type TplLine = { productId?: string; label: string; quantity: number; unitPriceHt: number; taxRatePct: number };

/**
 * Factures récurrentes (abonnements). La génération est **à la demande** (bouton) : pour chaque
 * modèle actif dont l'échéance est atteinte, une facture brouillon est créée et l'échéance avancée.
 * Pas de cron externe requis ; l'utilisateur (ou une tâche planifiée) déclenche `generateDue`.
 */
export const recurringRouter = router({
  list: authed('read', 'Invoice').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.recurringInvoice.findMany({
        where: scope(ctx.societeId),
        include: { company: { select: { name: true } } },
        orderBy: [{ active: 'desc' }, { nextRunAt: 'asc' }],
      })
    )
  ),

  create: authed('create', 'Invoice').input(recurringCreate).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.recurringInvoice.create({
        data: {
          organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id,
          companyId: input.companyId, label: input.label, frequency: input.frequency, interval: input.interval,
          nextRunAt: new Date(input.nextRunAt), active: input.active,
          paymentTermId: input.paymentTermId ?? null, bankAccountId: input.bankAccountId ?? null,
          discountType: input.discountType, discountValue: input.discountValue,
          lines: input.lines,
        },
      })
    );
  }),

  update: authed('update', 'Invoice').input(recurringUpdate).mutation(({ ctx, input }) => {
    const { id, nextRunAt, lines, paymentTermId, bankAccountId, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.recurringInvoice.update({
        where: { id },
        data: {
          ...rest,
          ...(nextRunAt !== undefined ? { nextRunAt: new Date(nextRunAt) } : {}),
          ...(paymentTermId !== undefined ? { paymentTermId } : {}),
          ...(bankAccountId !== undefined ? { bankAccountId } : {}),
          ...(lines !== undefined ? { lines } : {}),
        },
      })
    );
  }),

  remove: authed('update', 'Invoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.recurringInvoice.delete({ where: { id: input.id } }))
  ),

  /** Duplique un abonnement (modèle identique, libellé suffixé « (copie) », suspendu par défaut). */
  duplicate: authed('create', 'Invoice').input(byId).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const src = await tx.recurringInvoice.findUniqueOrThrow({ where: { id: input.id } });
      return tx.recurringInvoice.create({
        data: {
          organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id,
          companyId: src.companyId, label: `${src.label} (copie)`, frequency: src.frequency, interval: src.interval,
          nextRunAt: src.nextRunAt, active: false, // suspendu : à réviser avant activation
          paymentTermId: src.paymentTermId, bankAccountId: src.bankAccountId,
          discountType: src.discountType, discountValue: src.discountValue, lines: src.lines as never,
        },
      });
    });
  }),

  /**
   * Génère les factures dues : pour chaque modèle actif dont `nextRunAt` ≤ maintenant, crée une
   * facture brouillon (lignes + remise du modèle) et avance `nextRunAt` selon la fréquence.
   * Rattrape les échéances passées (boucle) pour ne pas sauter de période.
   */
  generateDue: authed('create', 'Invoice').mutation(({ ctx }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const now = new Date();
      const due = await tx.recurringInvoice.findMany({ where: { ...scope(societeId), active: true, nextRunAt: { lte: now } } });
      const created: string[] = [];
      for (const tpl of due) {
        let next = new Date(tpl.nextRunAt);
        let guard = 0;
        // Rattrapage : une facture par échéance atteinte (borne de sécurité à 60 périodes).
        while (next <= now && guard < 60) {
          const lines = (tpl.lines as unknown as TplLine[]);
          const inv = await tx.invoice.create({
            data: {
              docType: 'facture', status: 'draft',
              organizationId: ctx.user.organizationId, societeId, companyId: tpl.companyId, createdById: ctx.user.id,
              paymentTermId: tpl.paymentTermId, bankAccountId: tpl.bankAccountId,
              discountType: tpl.discountType, discountValue: tpl.discountValue,
              notes: `Abonnement : ${tpl.label} (échéance du ${next.toISOString().slice(0, 10)})`,
              lines: { create: lines.map((l, i) => ({ productId: l.productId || undefined, label: l.label, quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: i })) },
            },
          });
          created.push(inv.id);
          next = nextOccurrence(next, tpl.frequency as RecurrenceFrequency, tpl.interval);
          guard++;
        }
        await tx.recurringInvoice.update({ where: { id: tpl.id }, data: { nextRunAt: next, lastRunAt: now } });
      }
      return { generated: created.length };
    });
  }),
});
