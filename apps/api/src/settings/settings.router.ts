import { prisma } from '@jampack/db';
import { themeColors, DEFAULT_THEME } from '@jampack/domain';
import { router, protectedProcedure, authed } from '../trpc/trpc';

/**
 * Paramètres du compte — dont le look & feel (couleurs de marque).
 * Le thème est stocké au niveau du COMPTE (Organization) : tous les utilisateurs du
 * compte voient la même charte. Modification réservée à l'administration.
 */
export const settingsRouter = router({
  getTheme: protectedProcedure.query(async ({ ctx }) => {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.user.organizationId },
      select: { theme: true },
    });
    return (org?.theme as typeof DEFAULT_THEME | null) ?? DEFAULT_THEME;
  }),

  setTheme: authed('manage', 'all').input(themeColors).mutation(async ({ ctx, input }) => {
    await prisma.organization.update({ where: { id: ctx.user.organizationId }, data: { theme: input } });
    return input;
  }),
});
