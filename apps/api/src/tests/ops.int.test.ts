import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;

beforeAll(async () => {
  C = await demoCaller();
  caller = C.caller;
  await C.prisma.opsExecution.deleteMany({ where: { organizationId: C.org.id } });
});
afterAll(async () => { await C.prisma.opsExecution.deleteMany({ where: { organizationId: C.org.id } }); });

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
});
