import { TRPCError } from '@trpc/server';
import { defineAbilityFor } from '@jampack/domain';

// Niveaux de super-admin : TECHNICIEN d'instance (manage:Ops) vs GÉNÉRAL JAMPACK (manage:PlatformOps).
export interface Tier { instance: boolean; platform: boolean }

export function tierOf(perms: { action: string; subject: string }[]): Tier {
  const a = defineAbilityFor(perms);
  const all = a.can('manage', 'all');
  return { instance: all || a.can('manage', 'Ops'), platform: all || a.can('manage', 'PlatformOps') };
}

export function requireAny(t: Tier): void {
  if (!t.instance && !t.platform) throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès réservé au super-admin.' });
}
