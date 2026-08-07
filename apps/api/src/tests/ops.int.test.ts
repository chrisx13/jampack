import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from '../trpc/router';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any; // manage:all → technicien + général
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let technicianOnly: any; // manage:Ops uniquement (technicien d'instance)

beforeAll(async () => {
  C = await demoCaller();
  caller = C.caller;
  const ctx = { user: { id: 'u-tech', organizationId: C.org.id, permissions: [{ action: 'manage', subject: 'Ops' }], accessibleSocietes: null as string[] | null }, societeId: C.soc.id as string | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  technicianOnly = appRouter.createCaller(ctx as any);
  await C.prisma.opsExecution.deleteMany({ where: { organizationId: C.org.id } });
  await C.prisma.instanceConfig.deleteMany({ where: { organizationId: C.org.id } });
});
afterAll(async () => {
  await C.prisma.opsExecution.deleteMany({ where: { organizationId: C.org.id } });
  await C.prisma.instanceConfig.deleteMany({ where: { organizationId: C.org.id } });
});

describe('Console super-admin — catalogue', () => {
  it('expose le catalogue et les catégories', async () => {
    const c = await caller.ops.catalogue();
    expect(c.operations.length).toBeGreaterThan(0);
    expect(c.operations.some((o: { id: string }) => o.id === 'db.health')).toBe(true);
    // Toute opération dangereuse exige une confirmation typée.
    expect(c.operations.filter((o: { danger: string }) => o.danger === 'danger').every((o: { requiresConfirmation: boolean }) => o.requiresConfirmation)).toBe(true);
  });
});

describe('Console super-admin — opérations sûres', () => {
  it('db.health : base joignable + audit', async () => {
    const r = await caller.ops.run({ id: 'db.health' });
    expect(r.status).toBe('ok');
    expect(r.summary).toMatch(/joignable/i);
    const rows = await C.prisma.opsExecution.findMany({ where: { organizationId: C.org.id, opId: 'db.health' } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('app.info : renvoie version/environnement (sans secret)', async () => {
    const r = await caller.ops.run({ id: 'app.info' });
    expect(r.status).toBe('ok');
    expect(r.details).toHaveProperty('environnement');
    expect(JSON.stringify(r.details)).not.toMatch(/password|@.*:.*@/);
  });

  it('rls.verify : politiques d’isolation présentes', async () => {
    const r = await caller.ops.run({ id: 'rls.verify' });
    expect(r.status).toBe('ok');
    expect((r.details as { manquantes: string[] }).manquantes).toHaveLength(0);
  });

  it('migrations.status : lisible', async () => {
    const r = await caller.ops.run({ id: 'migrations.status' });
    expect(['ok', 'error']).toContain(r.status);
  });
});

describe('Console super-admin — garde-fous', () => {
  it('opération inconnue → NOT_FOUND', async () => {
    await expect(caller.ops.run({ id: 'n.existe.pas' })).rejects.toThrow();
  });

  it('opération dangereuse sans confirmation → refusée', async () => {
    await expect(caller.ops.run({ id: 'db.restore', params: { file: 'd.gz' } })).rejects.toThrow(/Confirmation/i);
  });

  it('opération hôte en dry-run → simulation (aucun effet)', async () => {
    const r = await caller.ops.run({ id: 'db.backup', dryRun: true, params: { label: 'test' } });
    expect(r.status).toBe('ok');
    expect(r.summary).toMatch(/simulation/i);
  });

  it('opération hôte réelle → bloquée (runner désactivé)', async () => {
    const r = await caller.ops.run({ id: 'app.restart', confirmation: 'REDEMARRER' });
    expect(r.status).toBe('blocked');
  });

  it('historique : trace les exécutions de l’organisation', async () => {
    const h = await caller.ops.history();
    expect(h.rows.length).toBeGreaterThan(0);
    expect(h.rows.every((r: { organizationId: string }) => r.organizationId === C.org.id)).toBe(true);
  });

  it('provisionnement réservé au niveau « platform »', async () => {
    // Le technicien d'instance ne voit pas l'opération et ne peut pas l'exécuter.
    const cat = await technicianOnly.ops.catalogue();
    expect(cat.operations.some((o: { id: string }) => o.id === 'instance.provision')).toBe(false);
    await expect(technicianOnly.ops.run({ id: 'instance.provision', params: { name: 'x', mode: 'test' }, confirmation: 'CREER' })).rejects.toThrow();
  });
});

describe('Console super-admin — diagnostic de configuration', () => {
  it('renvoie des défauts avec gravités et synthèse', async () => {
    const d = await caller.ops.diagnostics();
    expect(d.summary).toHaveProperty('total');
    expect(Array.isArray(d.findings)).toBe(true);
    if (d.findings.length) expect(['critical', 'warning', 'info']).toContain(d.findings[0].severity);
  });
});

describe('Instance — bascule prod/test', () => {
  it('défaut « test », bascule en test sans confirmation', async () => {
    const s0 = await caller.instance.status();
    expect(['test', 'prod']).toContain(s0.mode);
    const r = await caller.instance.setMode({ mode: 'test' });
    expect(r.mode).toBe('test');
  });
  it('passage en prod exige la confirmation « PROD »', async () => {
    await expect(caller.instance.setMode({ mode: 'prod' })).rejects.toThrow(/PROD/);
    const r = await caller.instance.setMode({ mode: 'prod', confirmation: 'PROD' });
    expect(r.mode).toBe('prod');
    await caller.instance.setMode({ mode: 'test' }); // remise en test
  });
});

describe('Hébergement — le super-admin de structure n’existe que si serveur du client', () => {
  afterAll(async () => { await caller.instance.setHosting({ hosting: 'self' }); });

  it('self : le technicien de structure est actif', async () => {
    await caller.instance.setHosting({ hosting: 'self' });
    const s = await technicianOnly.instance.status();
    expect(s.hosting).toBe('self');
    expect(s.tier.instance).toBe(true);
  });

  it('jampack (hébergé) : le technicien de structure n’a plus accès ; seul le général pilote', async () => {
    await caller.instance.setHosting({ hosting: 'jampack' }); // caller = manage:all → tier platform
    await expect(technicianOnly.instance.status()).rejects.toThrow(/super-admin/i);
    await expect(technicianOnly.config.list()).rejects.toThrow(/super-admin/i);
    expect((await caller.instance.status()).tier.platform).toBe(true);
  });

  it('setHosting réservé au général (platform)', async () => {
    await expect(technicianOnly.instance.setHosting({ hosting: 'self' })).rejects.toThrow(/général/i);
  });
});
