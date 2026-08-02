import { router } from './trpc';
import { crmRouter } from '../crm/crm.router';
import { iamRouter } from '../iam/iam.router';
import { societeRouter } from '../societe/societe.router';
import { catalogRouter } from '../catalog/catalog.router';

export const appRouter = router({
  crm: crmRouter,
  iam: iamRouter,
  societes: societeRouter,
  catalog: catalogRouter,
});

/** Type consommé par les clients (web, desktop, mobile) pour la type-safety. */
export type AppRouter = typeof appRouter;
