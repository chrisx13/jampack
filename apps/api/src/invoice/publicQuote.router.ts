import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withPublicToken } from '@jampack/db';
import { router, publicProcedure } from '../trpc/trpc';
import { salesTotals } from './salesRouter';

const byToken = z.object({ token: z.string().min(8).max(128) });

/**
 * Signature en ligne du devis — procédures PUBLIQUES (sans authentification). L'accès est restreint
 * par le jeton du devis via la policy RLS `public_quote_token` (une seule pièce visible).
 */
export const publicQuoteRouter = router({
  get: publicProcedure.input(byToken).query(({ input }) =>
    withPublicToken(input.token, async (tx) => {
      const q = await tx.invoice.findFirst({
        where: { publicToken: input.token, docType: 'devis' },
        include: {
          lines: { orderBy: { position: 'asc' } },
          company: { select: { name: true } },
          societe: { select: { name: true, legalForm: true, capital: true, siret: true, tvaNumber: true, addressLine1: true, postalCode: true, city: true, email: true, phone: true } },
        },
      });
      if (!q) throw new TRPCError({ code: 'NOT_FOUND', message: 'Devis introuvable.' });
      return {
        number: q.number, status: q.status, issueDate: q.issueDate, validUntil: q.validUntil,
        acceptedAt: q.acceptedAt, acceptedByName: q.acceptedByName,
        client: q.company?.name ?? '', societe: q.societe,
        lines: q.lines.map((l) => ({ label: l.label, quantity: Number(l.quantity), unitPriceHt: Number(l.unitPriceHt), taxRatePct: Number(l.taxRatePct) })),
        ...salesTotals(q),
      };
    })
  ),

  accept: publicProcedure.input(byToken.extend({ signerName: z.string().min(2).max(120) })).mutation(({ ctx, input }) =>
    withPublicToken(input.token, async (tx) => {
      const q = await tx.invoice.findFirst({ where: { publicToken: input.token, docType: 'devis' }, select: { id: true, status: true } });
      if (!q) throw new TRPCError({ code: 'NOT_FOUND', message: 'Devis introuvable.' });
      if (q.status === 'accepted') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce devis a déjà été accepté.' });
      if (q.status !== 'sent') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce devis ne peut pas être accepté en ligne.' });
      await tx.invoice.update({
        where: { id: q.id },
        data: { status: 'accepted', acceptedAt: new Date(), acceptedByName: input.signerName, acceptedIp: ctx.ip ?? null },
      });
      return { ok: true };
    })
  ),
});
