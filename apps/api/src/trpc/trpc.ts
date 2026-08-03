import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { defineAbilityFor } from '@jampack/domain';
import { withTenant } from '@jampack/db';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

/** Journal d'audit : trace chaque mutation réussie (qui, quoi, quand). Non bloquant. */
const auditMiddleware = t.middleware(async ({ ctx, next, path, type, getRawInput }) => {
  const res = await next();
  if (type === 'mutation' && res.ok && ctx.user) {
    try {
      const raw = (await getRawInput().catch(() => undefined)) as { id?: unknown } | undefined;
      const metadata = raw && typeof raw === 'object' && raw.id != null ? { id: String(raw.id) } : undefined;
      await withTenant(ctx.user.organizationId, (tx) =>
        tx.auditLog.create({ data: { organizationId: ctx.user!.organizationId, societeId: ctx.societeId ?? null, userId: ctx.user!.id, action: path, metadata } })
      );
    } catch { /* l'audit ne doit jamais faire échouer l'opération métier */ }
  }
  return res;
});

/** Exige un utilisateur authentifié ; expose ctx.user non-nul. Journalise les mutations. */
export const protectedProcedure = t.procedure
  .use(({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
  .use(auditMiddleware);

/**
 * Procédure autorisée : exige que le rôle (union des rôles de la société active)
 * accorde `action` sur `subject`, via CASL. Sinon FORBIDDEN.
 */
export const authed = (action: string, subject: string) =>
  protectedProcedure.use(({ ctx, next }) => {
    const ability = defineAbilityFor(ctx.user.permissions);
    if (!ability.can(action, subject)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Action non autorisée : ${action} ${subject}` });
    }
    return next();
  });
