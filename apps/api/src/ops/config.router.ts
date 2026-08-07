import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { maskSecret } from '@jampack/domain';
import { router, protectedProcedure } from '../trpc/trpc';
import { encryptSecret, decryptSecret, secretsEncryptionEnabled } from './crypto';
import { resolveTier, requireAny } from './tier';

// Gestion INTÉGRALE de la configuration d'une instance (réglages + clés/secrets).
// Deux niveaux de super-admin :
//  - TECHNICIEN de l'instance (manage:Ops) : gère toute la conf de SON instance ; peut RÉVÉLER les
//    valeurs secrètes en clair, et supprimer.
//  - GÉNÉRAL société JAMPACK (manage:PlatformOps) : voit les réglages non-secrets en clair et les
//    secrets TRONQUÉS ; peut POUSSER (set) n'importe quelle entrée sans jamais relire un secret en clair.
// Mécanisme des clés inchangé : `secret=true` → masquage/chiffrement ; `secret=false` → clair pour tous.

const nameSchema = z.string().min(1).max(120).regex(/^[A-Za-z0-9_.-]+$/, 'Nom invalide (A-Z, 0-9, _.-).');

export const configRouter = router({
  /** Liste de la configuration. Secrets → masqués ; non-secrets → en clair (pour les deux niveaux). */
  list: protectedProcedure.query(async ({ ctx }) => {
    const t = await resolveTier(ctx); requireAny(t);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.instanceConfig.findMany({ where: { organizationId: ctx.user.organizationId }, orderBy: [{ secret: 'desc' }, { name: 'asc' }] });
      return {
        encryptionEnabled: secretsEncryptionEnabled(),
        canReveal: t.instance, // seul le technicien de l'instance révèle un secret
        canWrite: t.instance || t.platform,
        canDelete: t.instance,
        items: rows.map((r) => {
          let display = '';
          try {
            const clear = decryptSecret(r.value, r.encrypted);
            display = r.secret ? maskSecret(clear) : clear; // non-secret : clair pour tous
          } catch { display = '••••••'; }
          return { name: r.name, secret: r.secret, encrypted: r.encrypted, description: r.description, display, updatedAt: r.updatedAt };
        }),
      };
    });
  }),

  /** Révèle la valeur en clair d'un SECRET — technicien de l'instance uniquement. */
  reveal: protectedProcedure.input(z.object({ name: nameSchema })).query(async ({ ctx, input }) => {
    const t = await resolveTier(ctx);
    if (!t.instance) throw new TRPCError({ code: 'FORBIDDEN', message: 'Seul le technicien de l’instance peut révéler un secret en clair.' });
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const s = await tx.instanceConfig.findUniqueOrThrow({ where: { organizationId_name: { organizationId: ctx.user.organizationId, name: input.name } } });
      return { name: s.name, value: decryptSecret(s.value, s.encrypted) };
    });
  }),

  /** Positionne/pousse une entrée (upsert). Technicien de l'instance OU super-admin général. */
  set: protectedProcedure
    .input(z.object({ name: nameSchema, value: z.string().min(1).max(20_000), secret: z.boolean().default(true), description: z.string().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const t = await resolveTier(ctx); requireAny(t);
      const enc = input.secret ? encryptSecret(input.value) : { value: input.value, encrypted: false };
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        await tx.instanceConfig.upsert({
          where: { organizationId_name: { organizationId: ctx.user.organizationId, name: input.name } },
          update: { value: enc.value, secret: input.secret, encrypted: enc.encrypted, description: input.description ?? null, updatedById: ctx.user.id },
          create: { organizationId: ctx.user.organizationId, name: input.name, value: enc.value, secret: input.secret, encrypted: enc.encrypted, description: input.description ?? null, updatedById: ctx.user.id },
        });
        return { ok: true, encrypted: enc.encrypted };
      });
    }),

  /** Supprime une entrée — technicien de l'instance uniquement. */
  remove: protectedProcedure.input(z.object({ name: nameSchema })).mutation(async ({ ctx, input }) => {
    const t = await resolveTier(ctx);
    if (!t.instance) throw new TRPCError({ code: 'FORBIDDEN', message: 'Seul le technicien de l’instance peut supprimer une entrée.' });
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      await tx.instanceConfig.delete({ where: { organizationId_name: { organizationId: ctx.user.organizationId, name: input.name } } });
      return { ok: true };
    });
  }),
});
