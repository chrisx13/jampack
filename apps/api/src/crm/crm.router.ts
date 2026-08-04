import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import {
  companyCreate, companyUpdate,
  contactCreate, contactUpdate,
  opportunityCreate, opportunityUpdate, opportunityMove,
  activityCreate, byId,
  establishmentCreate, establishmentUpdate,
} from '@jampack/domain';
import { router, protectedProcedure, authed } from '../trpc/trpc';

/**
 * Filtre société (défense en profondeur). L'isolation « dure » entre sociétés d'un même
 * compte est assurée par le RLS : withTenant(org, ctx.societeId, …) positionne
 * app.current_societe et la policy restrictive `societe_isolation` s'applique.
 */
const scope = (societeId: string | null) => (societeId ? { societeId } : {});

function requireSociete(societeId: string | null): string {
  if (!societeId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société avant de créer un enregistrement.' });
  return societeId;
}

export const crmRouter = router({
  // ── Clients (Company) ──
  companies: router({
    list: authed('read', 'Company').query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.company.findMany({
          where: { ...scope(ctx.societeId), isCustomer: true },
          include: { societe: { select: { name: true } }, _count: { select: { establishments: true, contacts: true } } },
          orderBy: { createdAt: 'desc' },
        })
      )
    ),
    create: authed('create', 'Company').input(companyCreate).mutation(({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.company.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id } })
      );
    }),
    update: authed('update', 'Company').input(companyUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.company.update({ where: { id }, data }));
    }),
    remove: authed('delete', 'Company').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        await tx.contact.updateMany({ where: { companyId: input.id }, data: { companyId: null } });
        await tx.opportunity.updateMany({ where: { companyId: input.id }, data: { companyId: null } });
        await tx.establishment.deleteMany({ where: { companyId: input.id } });
        return tx.company.delete({ where: { id: input.id } });
      })
    ),

    /** Export RGPD (droit d'accès / portabilité, art. 15/20) : données personnelles détenues sur un tiers. */
    exportData: authed('read', 'Company').input(byId).query(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const c = await tx.company.findUniqueOrThrow({
          where: { id: input.id },
          include: {
            contacts: { select: { firstName: true, lastName: true, email: true, phone: true, createdAt: true } },
            establishments: { select: { name: true, siret: true, addressLine1: true, addressLine2: true, postalCode: true, city: true, phone: true, email: true } },
            opportunities: { select: { title: true, amount: true, createdAt: true, stage: { select: { name: true } } } },
          },
        });
        return {
          generatedAt: new Date(),
          subject: { name: c.name, siren: c.siren, siret: c.siret, tvaNumber: c.tvaNumber, doNotProspect: c.doNotProspect, isCustomer: c.isCustomer, isSupplier: c.isSupplier, createdAt: c.createdAt },
          contacts: c.contacts,
          establishments: c.establishments,
          opportunities: c.opportunities,
        };
      })
    ),
  }),

  // ── Établissements (adresses d'un client) ──
  establishments: router({
    list: authed('read', 'Company').input(z.object({ companyId: z.string() })).query(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.establishment.findMany({ where: { companyId: input.companyId }, orderBy: [{ isHeadquarters: 'desc' }, { name: 'asc' }] })
      )
    ),
    create: authed('update', 'Company').input(establishmentCreate).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const company = await tx.company.findUniqueOrThrow({ where: { id: input.companyId }, select: { societeId: true } });
        return tx.establishment.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId: company.societeId } });
      })
    ),
    update: authed('update', 'Company').input(establishmentUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.establishment.update({ where: { id }, data }));
    }),
    remove: authed('update', 'Company').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        await tx.contact.updateMany({ where: { establishmentId: input.id }, data: { establishmentId: null } });
        return tx.establishment.delete({ where: { id: input.id } });
      })
    ),
  }),

  // ── Contacts ──
  contacts: router({
    list: authed('read', 'Contact').query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.contact.findMany({ where: scope(ctx.societeId), include: { societe: { select: { name: true } }, company: { select: { name: true } } }, orderBy: { lastName: 'asc' } })
      )
    ),
    create: authed('create', 'Contact').input(contactCreate).mutation(({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.contact.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId } }));
    }),
    update: authed('update', 'Contact').input(contactUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.contact.update({ where: { id }, data }));
    }),
    remove: authed('delete', 'Contact').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        await tx.activity.updateMany({ where: { contactId: input.id }, data: { contactId: null } });
        return tx.contact.delete({ where: { id: input.id } });
      })
    ),
  }),

  // ── Opportunités ──
  opportunities: router({
    list: authed('read', 'Opportunity').query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.opportunity.findMany({ where: scope(ctx.societeId), include: { stage: true, societe: { select: { name: true } }, company: { select: { name: true } } }, orderBy: { createdAt: 'desc' } })
      )
    ),
    create: authed('create', 'Opportunity').input(opportunityCreate).mutation(({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.opportunity.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId } }));
    }),
    update: authed('update', 'Opportunity').input(opportunityUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.opportunity.update({ where: { id }, data }));
    }),
    /** Déplacement dans le pipeline (kanban). */
    move: authed('update', 'Opportunity').input(opportunityMove).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.opportunity.update({ where: { id: input.id }, data: { stageId: input.stageId } }))
    ),
    remove: authed('delete', 'Opportunity').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        await tx.activity.updateMany({ where: { opportunityId: input.id }, data: { opportunityId: null } });
        return tx.opportunity.delete({ where: { id: input.id } });
      })
    ),
  }),

  // ── Étapes du pipeline (niveau compte) ──
  stages: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.pipelineStage.findMany({ orderBy: { order: 'asc' } }))
    ),
  }),

  // ── Activités ──
  activities: router({
    list: authed('read', 'Opportunity').input(byId.partial()).query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.activity.findMany({ where: { ...scope(ctx.societeId) }, orderBy: { createdAt: 'desc' }, take: 50 })
      )
    ),
    create: authed('create', 'Opportunity').input(activityCreate).mutation(({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.activity.create({ data: { ...input, dueAt: input.dueAt ? new Date(input.dueAt) : undefined, organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id } })
      );
    }),
  }),
});
