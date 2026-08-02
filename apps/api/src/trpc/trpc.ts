import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { defineAbilityFor } from '@jampack/domain';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

/** Exige un utilisateur authentifié ; expose ctx.user non-nul. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

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
