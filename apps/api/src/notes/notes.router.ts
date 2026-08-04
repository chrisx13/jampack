import { withTenant } from '@jampack/db';
import { byId, byViewKey, viewNoteCreate, viewNoteEdit, viewNoteMove, viewNoteColor } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';
import { requireSociete } from '../invoice/salesRouter';

const author = { select: { id: true, name: true, email: true } };

/**
 * Notes de vue : pense-bêtes partagés, ancrés à une vue (viewKey) et à la société active.
 * - visibles par tous les utilisateurs ayant le droit `read Note` (donc accès à la vue) ;
 * - éditables avec historisation (chaque modification crée une ViewNoteRevision) ;
 * - déplaçables (x/y) pour ne pas masquer les données ; plusieurs notes par vue.
 */
export const notesRouter = router({
  list: authed('read', 'Note').input(byViewKey).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.viewNote.findMany({
        where: { viewKey: input.viewKey },
        include: { createdBy: author, _count: { select: { revisions: true } } },
        orderBy: { createdAt: 'asc' },
      })
    )
  ),

  create: authed('create', 'Note').input(viewNoteCreate).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.viewNote.create({
        data: {
          organizationId: ctx.user.organizationId,
          societeId,
          viewKey: input.viewKey,
          content: input.content,
          color: input.color,
          x: input.x,
          y: input.y,
          createdById: ctx.user.id,
          // La création initialise l'historique si un contenu est déjà saisi.
          revisions: input.content ? { create: { organizationId: ctx.user.organizationId, content: input.content, authorId: ctx.user.id } } : undefined,
        },
        include: { createdBy: author, _count: { select: { revisions: true } } },
      })
    );
  }),

  /** Édition du contenu : historise l'ancienne valeur avant d'écrire la nouvelle. */
  edit: authed('update', 'Note').input(viewNoteEdit).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const prev = await tx.viewNote.findUniqueOrThrow({ where: { id: input.id } });
      if (prev.content === input.content) return prev;
      return tx.viewNote.update({
        where: { id: input.id },
        data: {
          content: input.content,
          revisions: { create: { organizationId: ctx.user.organizationId, content: input.content, authorId: ctx.user.id } },
        },
        include: { createdBy: author, _count: { select: { revisions: true } } },
      });
    })
  ),

  /** Déplacement (persistance de la position) — pas d'historisation, geste d'IHM. */
  move: authed('update', 'Note').input(viewNoteMove).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.viewNote.update({ where: { id: input.id }, data: { x: input.x, y: input.y } })
    )
  ),

  setColor: authed('update', 'Note').input(viewNoteColor).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.viewNote.update({ where: { id: input.id }, data: { color: input.color } })
    )
  ),

  /** Historique des modifications d'une note (récent → ancien). */
  history: authed('read', 'Note').input(byId).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.viewNoteRevision.findMany({
        where: { noteId: input.id },
        include: { author },
        orderBy: { createdAt: 'desc' },
      })
    )
  ),

  remove: authed('delete', 'Note').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.viewNote.delete({ where: { id: input.id } }))
  ),
});
