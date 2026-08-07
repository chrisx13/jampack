import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { defineAbilityFor } from '@jampack/domain';

// Niveaux de super-admin :
//  - GÉNÉRAL = technicien de la société JAMPACK (manage:PlatformOps) — opérateur flotte ;
//  - INSTANCE = technicien de la structure cliente (manage:Ops) — MAIS uniquement si le serveur
//    appartient au client (HOSTING_MODE = 'self'). Sur une instance hébergée par JAMPACK
//    (HOSTING_MODE = 'jampack'), le niveau instance n'existe pas : seul le général pilote.

export type HostingMode = 'self' | 'jampack';
export interface Tier { instance: boolean; platform: boolean; hosting: HostingMode }

export const HOSTING_KEY = 'HOSTING_MODE';

/** Niveaux BRUTS (droits CASL, sans tenir compte de l'hébergement). Sert au provisioning (setHosting). */
export function rawTierOf(perms: { action: string; subject: string }[]) {
  const a = defineAbilityFor(perms);
  const all = a.can('manage', 'all');
  return { instance: all || a.can('manage', 'Ops'), platform: all || a.can('manage', 'PlatformOps') };
}

/**
 * Résout le niveau EFFECTIF selon l'hébergement (ISOLATION ABSOLUE) :
 *  - `self` (serveur du client) → seul le niveau INSTANCE est actif ; le GÉNÉRAL n'a AUCUN accès ;
 *  - `jampack` (hébergé) → seul le niveau GÉNÉRAL est actif ; le niveau instance n'existe pas.
 */
export async function resolveTier(ctx: { user: { organizationId: string; permissions: { action: string; subject: string }[] }; societeId: string | null }): Promise<Tier> {
  const raw = rawTierOf(ctx.user.permissions);
  const hosting = await withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const row = await tx.instanceConfig.findUnique({ where: { organizationId_name: { organizationId: ctx.user.organizationId, name: HOSTING_KEY } } });
    return ((row?.value as HostingMode) || 'self');
  }).catch(() => 'self' as HostingMode);
  return {
    instance: raw.instance && hosting === 'self',
    platform: raw.platform && hosting === 'jampack',
    hosting,
  };
}

export function requireAny(t: { instance: boolean; platform: boolean }): void {
  if (!t.instance && !t.platform) throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès réservé au super-admin.' });
}
