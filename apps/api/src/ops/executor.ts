// Exécuteur d'opérations techniques — console super-admin.
//
// SÉCURITÉ : n'exécute QUE des opérations du catalogue (jamais de shell arbitraire). Les opérations
// « sûres » tournent en-process / via des requêtes BDD en lecture. Les opérations nécessitant un accès
// hôte (sauvegarde/restauration/redémarrage) sont **bloquées par défaut** (runner désactivé) : elles
// renvoient une simulation en dry-run et un statut « blocked » sinon. Aucune commande hôte n'est lancée
// tant qu'un runner explicite n'est pas fourni (hors périmètre de ce socle).

import type { OpDef } from '@jampack/domain';
import { prisma } from '@jampack/db';

export interface OpResult {
  status: 'ok' | 'error' | 'blocked';
  summary: string;
  details?: Record<string, unknown>;
}

/** Masque les identifiants d'une URL de base (ne renvoie que hôte/port/base). */
function safeDbInfo(url?: string): string {
  if (!url) return 'inconnue';
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return 'inconnue';
  }
}

const EXPECTED_RLS_TABLES = [
  'Societe', 'Company', 'Contact', 'Opportunity', 'Invoice', 'Payment', 'SupplierInvoice',
  'JournalEntry', 'Expense', 'AiCreditLedger', 'OpsExecution',
];

/** Exécute une opération sûre en lecture. Lève seulement sur incident inattendu (capté par le routeur). */
async function runSafe(op: OpDef): Promise<OpResult> {
  switch (op.id) {
    case 'app.info': {
      const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
      return {
        status: 'ok',
        summary: 'Instance opérationnelle.',
        details: {
          version: process.env.npm_package_version || 'dev',
          environnement: process.env.NODE_ENV || 'inconnu',
          heureServeur: now,
          base: safeDbInfo(process.env.DATABASE_URL_APP || process.env.DATABASE_URL),
          enrichissementIA: process.env.ANTHROPIC_API_KEY ? 'activé' : 'désactivé',
        },
      };
    }
    case 'db.health': {
      await prisma.$queryRaw`SELECT 1`;
      const orgs = await prisma.organization.count();
      const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
      return { status: 'ok', summary: `Base joignable — ${orgs} organisation(s).`, details: { connectivite: 'ok', organisations: orgs, heureServeur: now } };
    }
    case 'migrations.status': {
      try {
        const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`
          SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 100`;
        const applied = rows.filter((r) => r.finished_at && !r.rolled_back_at);
        const failed = rows.filter((r) => !r.finished_at || r.rolled_back_at);
        return {
          status: failed.length ? 'error' : 'ok',
          summary: failed.length ? `${failed.length} migration(s) en échec/incomplètes.` : `${applied.length} migration(s) appliquées.`,
          details: { appliquees: applied.length, derniere: applied[0]?.migration_name ?? null, enEchec: failed.map((f) => f.migration_name) },
        };
      } catch {
        return { status: 'ok', summary: 'Historique des migrations non lisible avec le rôle applicatif (normal en production).', details: {} };
      }
    }
    case 'rls.verify': {
      const rows = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_policies WHERE policyname = 'org_isolation'`;
      const withPolicy = new Set(rows.map((r) => r.tablename));
      const missing = EXPECTED_RLS_TABLES.filter((t) => !withPolicy.has(t));
      return {
        status: missing.length ? 'error' : 'ok',
        summary: missing.length ? `RLS manquant sur : ${missing.join(', ')}.` : `RLS présent sur ${withPolicy.size} table(s).`,
        details: { tablesAvecPolicy: withPolicy.size, manquantes: missing },
      };
    }
    default:
      return { status: 'error', summary: `Opération sûre inconnue : ${op.id}.` };
  }
}

/**
 * Point d'entrée. `dryRun` : simule (aucun effet). Les opérations hôte restent bloquées tant qu'aucun
 * runner n'est configuré (OPS_HOST_RUNNER) — ce socle ne lance délibérément aucune commande hôte.
 */
export async function runOp(op: OpDef, params: Record<string, unknown>, opts: { dryRun: boolean }): Promise<OpResult> {
  if (op.needsHostRunner) {
    const runnerConfigured = !!process.env.OPS_HOST_RUNNER;
    const what = `${op.label}${Object.keys(params).length ? ` (${JSON.stringify(params)})` : ''}`;
    if (opts.dryRun) {
      return { status: 'ok', summary: `Simulation : « ${what} » serait exécutée via le runner hôte.`, details: { runnerConfigure: runnerConfigured, simulation: true } };
    }
    return {
      status: 'blocked',
      summary: runnerConfigured
        ? 'Runner hôte présent mais l’exécution réelle des opérations hôte n’est pas activée dans ce socle.'
        : 'Runner hôte désactivé (OPS_HOST_RUNNER non configuré) — action non exécutée.',
      details: { runnerConfigure: runnerConfigured },
    };
  }
  if (opts.dryRun) return { status: 'ok', summary: `Simulation : « ${op.label} » (lecture seule, sans effet).`, details: { simulation: true } };
  return runSafe(op);
}
