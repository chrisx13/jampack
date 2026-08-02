// Invariant de gouvernance : au moins UN administrateur ACTIF doit toujours exister sur le compte.
// Un « administrateur actif » = utilisateur actif ET détenant le rôle Administrateur lui-même actif.
// Le module Administration recalcule l'état APRÈS l'opération envisagée et la refuse si le compte
// se retrouverait sans administrateur actif (retrait du rôle, mise inactif de l'utilisateur,
// ou désactivation du rôle Administrateur).

export interface AdminMember {
  userId: string;
  userActive: boolean;
  /** L'utilisateur détient le rôle Administrateur ET ce rôle est actif. */
  hasActiveAdminRole: boolean;
}

/** Nombre d'administrateurs actifs. */
export function activeAdminCount(members: AdminMember[]): number {
  return members.filter((m) => m.userActive && m.hasActiveAdminRole).length;
}

/** `after` = état des membres APRÈS l'opération. Renvoie true si l'opération est interdite (0 admin actif). */
export function violatesLastActiveAdmin(after: AdminMember[]): boolean {
  return activeAdminCount(after) === 0;
}
