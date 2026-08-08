import { appRouter } from '../trpc/router';
import { prisma } from '@jampack/db';

/** Construit un caller tRPC « manage all » sur le compte de démo (société Boulangerie). */
export async function demoCaller() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'demo' } });
  const soc = await prisma.societe.findFirstOrThrow({ where: { organizationId: org.id, name: { contains: 'Boulangerie' } } });
  // Utilisateur déterministe (sinon l'ordre dépend de la BDD ; casse en CI sur base fraîche).
  const user = await prisma.user.findFirstOrThrow({ where: { email: 'compta@demo.fr' } });
  const ctx = {
    user: { id: user.id, organizationId: org.id, permissions: [{ action: 'manage', subject: 'all' }], accessibleSocietes: null as string[] | null },
    societeId: soc.id as string | null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = appRouter.createCaller(ctx as any);
  return { caller, org, soc, prisma };
}

export const N = (v: unknown) => Number(v as never);
