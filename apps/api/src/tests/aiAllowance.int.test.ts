import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;

const okFetch = () => vi.fn(async () => ({
  ok: true,
  json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ supplierName: 'X' }) }], usage: {} }),
}));

beforeAll(async () => {
  C = await demoCaller();
  caller = C.caller;
  await C.prisma.aiCreditLedger.deleteMany({ where: { organizationId: C.org.id } });
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.AI_FREE_MONTHLY_PER_USER = '2'; // franchise de 2 opérations / utilisateur / mois
});
afterAll(async () => {
  await C.prisma.aiCreditLedger.deleteMany({ where: { organizationId: C.org.id } });
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_FREE_MONTHLY_PER_USER;
});

describe('Franchise IA — gratuit jusqu’au seuil puis crédits payants', () => {
  it('les analyses dans la franchise sont GRATUITES (aucun crédit consommé)', async () => {
    vi.stubGlobal('fetch', okFetch());
    const s0 = await caller.documents.aiStatus();
    expect(s0.freeThreshold).toBe(2);
    expect(s0.freeRemaining).toBe(2);

    const r1 = await caller.documents.aiAnalyze({ text: 'a' });
    expect(r1.charged).toBe(false);
    const r2 = await caller.documents.aiAnalyze({ text: 'b' });
    expect(r2.charged).toBe(false);
    expect(r2.freeRemaining).toBe(0);
    // Solde payant inchangé (les gratuites ne le touchent pas).
    expect((await caller.documents.aiStatus()).balance).toBe(0);
    vi.unstubAllGlobals();
  });

  it('franchise épuisée sans crédit → bloqué', async () => {
    vi.stubGlobal('fetch', okFetch());
    await expect(caller.documents.aiAnalyze({ text: 'c' })).rejects.toThrow(/Franchise/i);
    vi.unstubAllGlobals();
  });

  it('après recharge → l’analyse au-delà de la franchise est PAYANTE', async () => {
    vi.stubGlobal('fetch', okFetch());
    await caller.documents.creditsTopup({ amount: 1 });
    const r = await caller.documents.aiAnalyze({ text: 'd' });
    expect(r.charged).toBe(true);
    expect(r.balance).toBe(0); // 1 crédit consommé
    vi.unstubAllGlobals();
  });
});
