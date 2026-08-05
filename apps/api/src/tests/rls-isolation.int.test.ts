import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@jampack/db';
import { demoCaller } from './caller';

// Client connecté au rôle APPLICATIF non-propriétaire (RLS réellement appliqué),
// contrairement au rôle propriétaire `jampack` (BYPASSRLS) utilisé par le reste des tests.
const APP_URL = process.env.DATABASE_URL_APP
  ?? 'postgresql://jampack_app:jampack@localhost:5432/jampack?schema=public';
const appDb = new PrismaClient({ datasources: { db: { url: APP_URL } } });

let C: Awaited<ReturnType<typeof demoCaller>>;
let orgId = '';
let socA = '';
let socB = '';
const createdCompanyIds: string[] = [];

beforeAll(async () => {
  C = await demoCaller();
  const org = await C.prisma.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  orgId = org.id;
  const socs = await C.prisma.societe.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' }, take: 2 });
  socA = socs[0].id; socB = socs[1].id;
  // Garantit au moins un client identifiable dans chaque société (nettoyé ensuite).
  for (const [soc, tag] of [[socA, '[RLS-A]'], [socB, '[RLS-B]']] as const) {
    const c = await C.prisma.company.create({ data: { organizationId: orgId, societeId: soc, name: `${tag} Isolation` } });
    createdCompanyIds.push(c.id);
  }
});

afterAll(async () => {
  await C.prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  await appDb.$disconnect();
});

/** Positionne le contexte RLS puis exécute `fn` (comme `withTenant`, mais via le rôle applicatif). */
async function asTenant<T>(org: string, societe: string | null, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return appDb.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${org}, true)`;
    if (societe) await tx.$executeRaw`SELECT set_config('app.current_societe', ${societe}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

describe('RLS — isolation multi-tenant (rôle applicatif non-propriétaire)', () => {
  it('le rôle applicatif n\'a PAS le bypass RLS', async () => {
    const [row] = await appDb.$queryRaw<{ rolbypassrls: boolean }[]>`SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(row.rolbypassrls).toBe(false);
  });

  it('société A ne voit que ses clients (RLS société), pas ceux de la société B', async () => {
    const rows = await asTenant(orgId, socA, (tx) => tx.company.findMany({ select: { societeId: true } }));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.societeId === socA)).toBe(true);
    expect(rows.some((r) => r.societeId === socB)).toBe(false);
  });

  it('société B ne voit que ses clients, pas ceux de la société A', async () => {
    const rows = await asTenant(orgId, socB, (tx) => tx.company.findMany({ select: { societeId: true } }));
    expect(rows.every((r) => r.societeId === socB)).toBe(true);
    expect(rows.some((r) => r.societeId === socA)).toBe(false);
  });

  it('vue consolidée (société non fixée) : toutes les sociétés du compte, mais isolées au compte', async () => {
    const rows = await asTenant(orgId, null, (tx) => tx.company.findMany({ select: { societeId: true } }));
    const socs = new Set(rows.map((r) => r.societeId));
    expect(socs.has(socA)).toBe(true);
    expect(socs.has(socB)).toBe(true);
  });

  it('sans contexte compte : aucune donnée visible (org_isolation)', async () => {
    // Aucun app.current_org positionné → la policy compte ne matche rien.
    const rows = await appDb.$transaction(async (tx) => tx.company.findMany({ select: { id: true } }));
    expect(rows.length).toBe(0);
  });
});
