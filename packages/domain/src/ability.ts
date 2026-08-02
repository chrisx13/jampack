import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';

export type AppAbility = MongoAbility;
export interface PermissionInput { action: string; subject: string }

/** Construit un Ability CASL à partir des permissions d'un rôle. */
export function defineAbilityFor(permissions: PermissionInput[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  for (const p of permissions) can(p.action, p.subject);
  return build();
}
