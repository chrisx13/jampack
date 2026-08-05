import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { prisma, withTenant, withUser } from '@jampack/db';
import { oidcEnabled, verifyAccessToken } from '../auth/oidc';

export interface AuthedUser {
  id: string;
  organizationId: string;
  permissions: { action: string; subject: string }[];
  /** Sociétés auxquelles l'utilisateur a accès (au moins un rôle). null = toutes (repli dev). */
  accessibleSocietes: string[] | null;
}

const DEV_STUB = new Set<unknown>([undefined, null, '', 'dev-user', 'dev-org', 'dev-societe']);
const ALL = '__all__'; // société active = consolidé
const DEV_FALLBACK = process.env.AUTH_DEV_STUB !== 'false'; // repli sans token (dev). "false" en prod.

const uniq = (xs: string[]) => Array.from(new Set(xs));

/** Union des permissions des rôles fournis (dans le contexte tenant). */
async function loadPermissions(organizationId: string, roleIds: string[]) {
  if (roleIds.length === 0) return [];
  const roles = await withTenant(organizationId, (tx) =>
    tx.role.findMany({ where: { id: { in: uniq(roleIds) } }, include: { permissions: true } })
  );
  const seen = new Set<string>();
  const out: { action: string; subject: string }[] = [];
  for (const r of roles) for (const p of r.permissions) {
    const k = `${p.action}:${p.subject}`;
    if (!seen.has(k)) { seen.add(k); out.push({ action: p.action, subject: p.subject }); }
  }
  return out;
}

/** Choisit la société active parmi les sociétés accessibles. */
function pickSociete(header: string | undefined, accessible: string[]): string | null {
  if (header === ALL) return null; // consolidé
  if (header && !DEV_STUB.has(header) && accessible.includes(header)) return header;
  return accessible[0] ?? null;
}

export async function createContext({ req }: CreateExpressContextOptions) {
  const orgHeader = (req.headers['x-org-id'] as string) || undefined;
  const societeHeader = (req.headers['x-societe-id'] as string) || undefined;
  const auth = (req.headers['authorization'] as string) || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : undefined;
  // IP du client (preuve d'acceptation en ligne du devis).
  const ip = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null) as string | null;

  // ── 1) Authentification réelle par jeton OIDC (Keycloak) ──
  if (bearer && oidcEnabled()) {
    const id = await verifyAccessToken(bearer); // lève si signature/issuer/audience invalides
    const dbUser = await prisma.user.upsert({
      where: { email: id.email },
      update: id.name ? { name: id.name } : {},
      create: { email: id.email, name: id.name },
    });

    // Appartenances (compte) + rôles par société de CET utilisateur (policies RLS *_self)
    const { memberships, societeRoles } = await withUser(dbUser.id, async (tx) => ({
      memberships: await tx.membership.findMany({ select: { organizationId: true } }),
      societeRoles: await tx.societeRole.findMany({ select: { organizationId: true, societeId: true, roleId: true } }),
    }));

    const orgIds = uniq([...memberships.map((m) => m.organizationId), ...societeRoles.map((r) => r.organizationId)]);
    if (orgIds.length === 0) return { user: null, societeId: null, ip }; // aucun compte → refusé

    const organizationId = orgHeader && orgIds.includes(orgHeader) ? orgHeader : orgIds[0];
    const orgRoles = societeRoles.filter((r) => r.organizationId === organizationId);
    const accessible = uniq(orgRoles.map((r) => r.societeId));
    const societeId = pickSociete(societeHeader, accessible);

    // Permissions effectives = union des rôles pour la société active (ou toutes en consolidé)
    const roleIds = (societeId ? orgRoles.filter((r) => r.societeId === societeId) : orgRoles).map((r) => r.roleId);
    const permissions = await loadPermissions(organizationId, roleIds);

    return {
      user: { id: dbUser.id, organizationId, permissions, accessibleSocietes: accessible } satisfies AuthedUser,
      societeId,
      ip,
    };
  }

  // ── 2) Repli DEV (aucun token) : compte + société seedés, permissions "manage all" ──
  if (DEV_FALLBACK) {
    const org = DEV_STUB.has(orgHeader)
      ? await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } })
      : await prisma.organization.findUnique({ where: { id: orgHeader! } });
    const u = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!org || !u) return { user: null, societeId: null, ip };
    const first = await withTenant(org.id, (tx) => tx.societe.findFirst({ orderBy: { createdAt: 'asc' } }));
    const societeId = societeHeader === ALL ? null : societeHeader && !DEV_STUB.has(societeHeader) ? societeHeader : first?.id ?? null;
    return {
      user: { id: u.id, organizationId: org.id, permissions: [{ action: 'manage', subject: 'all' }], accessibleSocietes: null } satisfies AuthedUser,
      societeId,
      ip,
    };
  }

  return { user: null as AuthedUser | null, societeId: null as string | null, ip };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
