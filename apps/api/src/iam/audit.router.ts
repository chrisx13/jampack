import { withTenant, type PrismaClient } from '@jampack/db';
import { auditLogCsv } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';

async function collectAudit(tx: PrismaClient, take: number) {
  const logs = await tx.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take });
  const ids = [...new Set(logs.map((l) => l.userId).filter((x): x is string => !!x))];
  const users = ids.length ? await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } }) : [];
  const email = new Map(users.map((u) => [u.id, u.email]));
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    at: l.createdAt,
    userEmail: l.userId ? email.get(l.userId) ?? l.userId : '—',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref: (l.metadata as any)?.id ?? null,
  }));
}

export const auditRouter = router({
  /** 200 dernières entrées du journal d'audit du compte. */
  list: authed('manage', 'all').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, (tx) => collectAudit(tx, 200))
  ),

  /** Export CSV du journal d'audit (jusqu'à 5000 entrées) — traçabilité RGPD/sécurité. */
  exportCsv: authed('manage', 'all').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, async (tx) => {
      const rows = await collectAudit(tx, 5000);
      return { filename: 'journal-audit.csv', content: auditLogCsv(rows) };
    })
  ),
});
