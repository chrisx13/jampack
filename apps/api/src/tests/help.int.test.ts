import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;

beforeAll(async () => {
  C = await demoCaller();
  caller = C.caller;
  await C.prisma.aiCreditLedger.deleteMany({ where: { organizationId: C.org.id } });
});
afterAll(async () => {
  await C.prisma.aiCreditLedger.deleteMany({ where: { organizationId: C.org.id } });
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
});

describe('Aide — niveau 1 (gratuit, local)', () => {
  it('topics : renvoie articles et catégories', async () => {
    const t = await caller.help.topics();
    expect(t.articles.length).toBeGreaterThan(0);
    expect(t.categories).toContain('Ventes');
  });
  it('search : trouve un guide pertinent', async () => {
    const r = await caller.help.search({ query: 'scanner une facture' });
    expect(r.results.some((a: { id: string }) => a.id === 'scanner')).toBe(true);
  });
});

describe('Aide — niveau 2 (assistant IA, crédits)', () => {
  it('IA désactivée par défaut', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await caller.help.aiStatus()).enabled).toBe(false);
  });

  it('refuse sans crédits', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    await expect(caller.help.ask({ question: 'Comment créer un devis ?' })).rejects.toThrow(/crédits/i);
  });

  it('répond, ancré sur l’aide, en consommant 1 crédit', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    await caller.documents.creditsTopup({ amount: 1 });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Ouvrez Ventes ▸ Devis puis Nouveau.' }], usage: {} }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const before = (await caller.help.aiStatus()).balance;
    const r = await caller.help.ask({ question: 'Comment créer un devis ?' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(r.answer).toMatch(/devis/i);
    expect(r.sources.some((s: { id: string }) => s.id === 'ventes-devis')).toBe(true);
    expect(r.balance).toBe(before - 1);
    vi.unstubAllGlobals();
  });
});
