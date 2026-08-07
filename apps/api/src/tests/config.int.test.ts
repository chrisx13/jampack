import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from '../trpc/router';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tech: any; // technicien de l'instance (manage:all ⊃ Ops)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let general: any; // super-admin général JAMPACK (manage:PlatformOps uniquement)

const KEY = 'ANTHROPIC_API_KEY';
const SECRET = 'sk-ant-secret-XYZ9876';

beforeAll(async () => {
  C = await demoCaller();
  tech = C.caller;
  const ctx = {
    user: { id: 'u-general', organizationId: C.org.id, permissions: [{ action: 'manage', subject: 'PlatformOps' }], accessibleSocietes: null as string[] | null },
    societeId: C.soc.id as string | null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  general = appRouter.createCaller(ctx as any);
  await C.prisma.instanceConfig.deleteMany({ where: { organizationId: C.org.id } });
});
afterAll(async () => { await C.prisma.instanceConfig.deleteMany({ where: { organizationId: C.org.id } }); });

describe('Config d’instance — secret (clé)', () => {
  it('le technicien positionne puis révèle en clair', async () => {
    await tech.config.set({ name: KEY, value: SECRET, secret: true });
    expect((await tech.config.reveal({ name: KEY })).value).toBe(SECRET);
  });

  it('liste : secret masqué pour les deux niveaux', async () => {
    for (const caller of [tech, general]) {
      const l = await caller.config.list();
      const it = l.items.find((x: { name: string }) => x.name === KEY);
      expect(it.secret).toBe(true);
      expect(it.display.endsWith('9876')).toBe(true);
      expect(JSON.stringify(l.items)).not.toContain(SECRET);
    }
  });

  it('général : ne peut ni révéler ni supprimer', async () => {
    expect((await general.config.list()).canReveal).toBe(false);
    await expect(general.config.reveal({ name: KEY })).rejects.toThrow(/technicien/i);
    await expect(general.config.remove({ name: KEY })).rejects.toThrow(/technicien/i);
  });

  it('général : peut POUSSER une clé (sans la relire)', async () => {
    await general.config.set({ name: 'PUSHED', value: 'poussée', secret: true });
    expect((await tech.config.reveal({ name: 'PUSHED' })).value).toBe('poussée');
    await expect(general.config.reveal({ name: 'PUSHED' })).rejects.toThrow();
  });
});

describe('Config d’instance — réglage non-secret', () => {
  it('valeur non-secrète visible en clair pour les deux niveaux', async () => {
    await tech.config.set({ name: 'WEB_ORIGIN', value: 'https://app.example.fr', secret: false });
    for (const caller of [tech, general]) {
      const it = (await caller.config.list()).items.find((x: { name: string }) => x.name === 'WEB_ORIGIN');
      expect(it.secret).toBe(false);
      expect(it.display).toBe('https://app.example.fr');
    }
  });
});
