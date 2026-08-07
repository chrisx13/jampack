import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from '../trpc/router';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let techOnly: any; // technicien de structure (manage:Ops) — actif seulement sur serveur client (self)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let general: any; // super-admin général JAMPACK (manage:PlatformOps) — actif seulement sur hébergé (jampack)

const KEY = 'ANTHROPIC_API_KEY';
const SECRET = 'sk-ant-secret-XYZ9876';

beforeAll(async () => {
  C = await demoCaller();
  const caller = (perms: { action: string; subject: string }[], id: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appRouter.createCaller({ user: { id, organizationId: C.org.id, permissions: perms, accessibleSocietes: null }, societeId: C.soc.id } as any);
  techOnly = caller([{ action: 'manage', subject: 'Ops' }], 'u-tech');
  general = caller([{ action: 'manage', subject: 'PlatformOps' }], 'u-general');
  await C.prisma.instanceConfig.deleteMany({ where: { organizationId: C.org.id } });
});
afterAll(async () => { await C.prisma.instanceConfig.deleteMany({ where: { organizationId: C.org.id } }); });

describe('Serveur du client (self) — technicien de structure actif, général ISOLÉ', () => {
  beforeAll(async () => { await general.instance.setHosting({ hosting: 'self' }); });

  it('le technicien positionne, révèle en clair, liste masquée', async () => {
    await techOnly.config.set({ name: KEY, value: SECRET, secret: true });
    expect((await techOnly.config.reveal({ name: KEY })).value).toBe(SECRET);
    const l = await techOnly.config.list();
    const it = l.items.find((x: { name: string }) => x.name === KEY);
    expect(it.display.endsWith('9876')).toBe(true);
    expect(l.canReveal).toBe(true);
    expect(JSON.stringify(l.items)).not.toContain(SECRET);
  });

  it('ISOLATION ABSOLUE : le super-admin général n’a AUCUN accès', async () => {
    await expect(general.config.list()).rejects.toThrow(/super-admin/i);
    await expect(general.config.reveal({ name: KEY })).rejects.toThrow();
  });

  it('réglage non-secret visible en clair pour le technicien', async () => {
    await techOnly.config.set({ name: 'WEB_ORIGIN', value: 'https://app.example.fr', secret: false });
    const it = (await techOnly.config.list()).items.find((x: { name: string }) => x.name === 'WEB_ORIGIN');
    expect(it.secret).toBe(false);
    expect(it.display).toBe('https://app.example.fr');
  });
});

describe('Hébergé JAMPACK (jampack) — général actif (masqué), technicien de structure SANS accès', () => {
  beforeAll(async () => { await general.instance.setHosting({ hosting: 'jampack' }); });

  it('le général voit la liste masquée, sans révéler, mais peut pousser', async () => {
    const l = await general.config.list();
    expect(l.canReveal).toBe(false);
    expect(l.canWrite).toBe(true);
    const it = l.items.find((x: { name: string }) => x.name === KEY);
    expect(it.display.endsWith('9876')).toBe(true);
    expect(JSON.stringify(l.items)).not.toContain(SECRET);
    await expect(general.config.reveal({ name: KEY })).rejects.toThrow(/technicien/i);
    await general.config.set({ name: 'PUSHED', value: 'poussée-general', secret: true });
    expect((await general.config.list()).items.some((x: { name: string }) => x.name === 'PUSHED')).toBe(true);
  });

  it('le technicien de structure n’a plus aucun accès sur une instance hébergée', async () => {
    await expect(techOnly.config.list()).rejects.toThrow(/super-admin/i);
  });
});
