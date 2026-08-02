import { useMemo } from 'react';
import { defineAbilityFor } from '@jampack/domain';
import { trpc } from './trpc';

/**
 * Hook de permissions basé sur les droits effectifs de l'utilisateur (union des rôles
 * pour la société active), renvoyés par iam.me. Utilisé pour afficher/masquer les actions.
 */
export function useCan() {
  const me = trpc.iam.me.useQuery();
  const ability = useMemo(() => defineAbilityFor(me.data?.permissions ?? []), [me.data]);
  return (action: string, subject: string) => ability.can(action, subject);
}
