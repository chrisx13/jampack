import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant, prisma } from '@jampack/db';
import { router, protectedProcedure } from '../trpc/trpc';
import { OPS_CATALOG, OPS_CATEGORIES, getOp, canExecute, tierAllows, evaluateConfig, summarizeFindings, opsHistoryCsv } from '@jampack/domain';
import { runOp } from './executor';
import { secretsEncryptionEnabled } from './crypto';
import { resolveTier, requireAny } from './tier';

const EXPECTED_RLS = ['Societe', 'Company', 'Contact', 'Opportunity', 'Invoice', 'Payment', 'SupplierInvoice', 'JournalEntry', 'Expense', 'AiCreditLedger', 'OpsExecution', 'InstanceConfig'];

/** Collecte les observations de configuration de l'instance courante (env + BDD). */
async function observeConfig(organizationId: string, societeId: string | null) {
  let pending = 0;
  try {
    const rows = await prisma.$queryRaw<{ finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT finished_at, rolled_back_at FROM "_prisma_migrations"`;
    pending = rows.filter((r) => !r.finished_at || r.rolled_back_at).length;
  } catch { pending = 0; }
  let rlsMissing: string[] = [];
  try {
    const pol = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_policies WHERE policyname = 'org_isolation'`;
    const have = new Set(pol.map((p) => p.tablename));
    rlsMissing = EXPECTED_RLS.filter((t) => !have.has(t));
  } catch { rlsMissing = []; }
  const societesMissingLegalIds = await withTenant(organizationId, societeId, (tx) =>
    tx.societe.count({ where: { OR: [{ siren: null }, { siren: '' }] } })
  ).catch(() => 0);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    authDevStub: process.env.AUTH_DEV_STUB === 'true',
    corsRestricted: !!process.env.WEB_ORIGIN,
    secretsEncryption: secretsEncryptionEnabled(),
    aiEnabled: !!process.env.ANTHROPIC_API_KEY,
    hostRunnerConfigured: !!process.env.OPS_HOST_RUNNER,
    backupConfigured: !!process.env.OPS_HOST_RUNNER && !!process.env.BACKUP_DIR,
    pendingOrFailedMigrations: pending,
    rlsMissingTables: rlsMissing,
    societesMissingLegalIds,
  };
}

// Console super-admin de pilotage technique. Gated par le droit `manage Ops`.
// Catalogue d'opérations PRÉDÉFINIES uniquement (aucun shell arbitraire) — voir opsCatalog (domaine)
// et executor (opérations sûres en-process ; opérations hôte bloquées par défaut). Chaque exécution
// (réelle ou simulée) est journalisée dans OpsExecution.

const runInput = z.object({
  id: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  dryRun: z.boolean().default(false),
  confirmation: z.string().optional(),
  target: z.string().default('local'), // 'local' ou identifiant d'instance (flotte, à venir)
});

export const opsRouter = router({
  /** Catalogue filtré selon le niveau (le technicien ne voit pas les opérations « platform », etc.). */
  catalogue: protectedProcedure.query(async ({ ctx }) => {
    const t = await resolveTier(ctx); requireAny(t);
    return { categories: OPS_CATEGORIES, operations: OPS_CATALOG.filter((op) => tierAllows(op, t)), tier: t };
  }),

  /** Diagnostic des défauts de configuration. Portée : instance courante (agrégat flotte à venir). */
  diagnostics: protectedProcedure.query(async ({ ctx }) => {
    const t = await resolveTier(ctx); requireAny(t);
    const observation = await observeConfig(ctx.user.organizationId, ctx.societeId);
    const findings = evaluateConfig(observation);
    return {
      scope: t.instance && !t.platform ? 'instance' : t.platform && !t.instance ? 'fleet' : 'instance+fleet',
      fleetAggregationPending: t.platform, // l'agrégat multi-instances arrivera avec la flotte
      findings,
      summary: summarizeFindings(findings),
    };
  }),

  /** Historique des exécutions (50 dernières), organisation courante. */
  history: protectedProcedure.query(async ({ ctx }) => {
    const t = await resolveTier(ctx); requireAny(t);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.opsExecution.findMany({ where: { organizationId: ctx.user.organizationId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return { rows };
    });
  }),

  /** Export CSV de l'historique des opérations (traçabilité/audit). */
  historyCsv: protectedProcedure.query(async ({ ctx }) => {
    const t = await resolveTier(ctx); requireAny(t);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.opsExecution.findMany({ where: { organizationId: ctx.user.organizationId }, orderBy: { createdAt: 'desc' } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = opsHistoryCsv(rows.map((r: any) => ({ date: r.createdAt, opId: r.opId, target: r.target, dryRun: r.dryRun, status: r.status, summary: r.summary })));
      return { filename: 'operations-pilotage.csv', content };
    });
  }),

  /** Exécute (ou simule) une opération : niveau requis + validation + confirmation typée, puis journalisation. */
  run: protectedProcedure
    .input(runInput)
    .mutation(async ({ ctx, input }) => {
      const t = await resolveTier(ctx); requireAny(t);
      const op = getOp(input.id);
      if (!op) throw new TRPCError({ code: 'NOT_FOUND', message: `Opération inconnue : ${input.id}.` });
      if (!tierAllows(op, t)) throw new TRPCError({ code: 'FORBIDDEN', message: `Opération réservée à un autre niveau de super-admin.` });

      const check = canExecute(op, input.params, { dryRun: input.dryRun, confirmation: input.confirmation });
      if (!check.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: check.errors.join(' ') });

      let result;
      try {
        result = await runOp(op, input.params, { dryRun: input.dryRun });
      } catch (e) {
        result = { status: 'error' as const, summary: `Échec : ${(e as Error).message}` };
      }

      // Journalisation systématique (réel ou simulé), organisation de l'opérateur.
      await withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.opsExecution.create({
          data: {
            organizationId: ctx.user.organizationId, opId: op.id, target: input.target,
            params: (input.params as object) ?? {}, dryRun: input.dryRun, status: result.status,
            summary: result.summary?.slice(0, 2000) ?? null, createdById: ctx.user.id,
          },
        })
      ).catch(() => { /* l'audit ne doit pas faire échouer l'opération */ });

      return { op: { id: op.id, label: op.label, danger: op.danger }, dryRun: input.dryRun, ...result };
    }),
});
