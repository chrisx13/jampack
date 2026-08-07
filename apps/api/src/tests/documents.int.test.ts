import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;

const SIREN = '732829320';
const SIRET = '73282932000009';
const TVA = 'FR44732829320';

const FACTURX = `<rsm:CrossIndustryInvoice>
  <rsm:ExchangedDocument><ram:ID>FA-2026-0042</ram:ID>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260312</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
  <ram:SellerTradeParty><ram:Name>Fournisseur Démo SARL</ram:Name>
    <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${SIRET}</ram:ID></ram:SpecifiedLegalOrganization>
    <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${TVA}</ram:ID></ram:SpecifiedTaxRegistration></ram:SellerTradeParty>
  <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    <ram:LineTotalAmount>100.00</ram:LineTotalAmount>
    <ram:TaxTotalAmount currencyID="EUR">20.00</ram:TaxTotalAmount>
    <ram:GrandTotalAmount>120.00</ram:GrandTotalAmount>
  </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
</rsm:CrossIndustryInvoice>`;

beforeAll(async () => {
  C = await demoCaller();
  caller = C.caller;
  // Repartir d'un solde de crédits IA propre pour cette organisation.
  await C.prisma.aiCreditLedger.deleteMany({ where: { organizationId: C.org.id } });
  // Franchise gratuite désactivée ici pour tester le chemin PAYANT (crédits). Franchise testée à part.
  process.env.AI_FREE_MONTHLY_PER_USER = '0';
});
afterAll(async () => {
  await C.prisma.aiCreditLedger.deleteMany({ where: { organizationId: C.org.id } });
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_FREE_MONTHLY_PER_USER;
});

describe('Reconnaissance de documents — niveau 1 (gratuit, local)', () => {
  it('Factur-X → mapping exact avec confiance haute + brouillon facture fournisseur', async () => {
    const r = await caller.documents.analyze({ facturxXml: FACTURX });
    expect(r.result.source).toBe('facturx');
    expect(r.result.fields.siret.valid).toBe(true);
    expect(r.result.fields.totalTtc.value).toBe(120);
    expect(r.supplierInvoiceDraft.supplierName).toBe('Fournisseur Démo SARL');
    expect(r.supplierInvoiceDraft.invoiceNumber).toBe('FA-2026-0042');
    expect(r.result.needsReview).toHaveLength(0);
  });

  it('texte de note de frais → catégorie devinée + HT calculé', async () => {
    const r = await caller.documents.analyze({ text: 'Restaurant Le Zinc\nDate : 05/07/2026\nTotal TTC : 24,00 €\nTVA 20%' });
    expect(r.expenseDraft.category).toBe('repas');
    expect(r.expenseDraft.taxRatePct).toBe(20);
    expect(r.expenseDraft.amountHt).toBe(20);
  });
});

describe('Reconnaissance de documents — niveau 2 (IA Claude, crédits)', () => {
  it('IA désactivée par défaut (aucune clé)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const s = await caller.documents.aiStatus();
    expect(s.enabled).toBe(false);
  });

  it('refuse l’analyse IA sans crédits', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    await expect(caller.documents.aiAnalyze({ text: 'facture' })).rejects.toThrow(/crédit|franchise/i);
  });

  it('recharge (admin) → statut activé + solde', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const t = await caller.documents.creditsTopup({ amount: 2, note: 'dotation test' });
    expect(t.balance).toBe(2);
    const s = await caller.documents.aiStatus();
    expect(s.enabled).toBe(true);
    expect(s.balance).toBe(2);
    expect(s.model).toBeTruthy();
  });

  it('analyse IA → fusion, consommation d’1 crédit, écriture au grand livre', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    // Mock de l'API Anthropic : renvoie un JSON de champs (comme Claude le ferait).
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify({ supplierName: 'ACME IA', totalTtc: 240, totalHt: 200, totalTva: 40, taxRatePct: 20, date: '2026-02-01' }) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const before = (await caller.documents.aiStatus()).balance;
    const r = await caller.documents.aiAnalyze({ text: 'photo illisible, peu de texte' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(r.result.fields.supplierName.value).toBe('ACME IA');
    expect(r.result.fields.totalTtc.value).toBe(240);
    expect(r.balance).toBe(before - 1);

    const ledger = await C.prisma.aiCreditLedger.findMany({ where: { organizationId: C.org.id, reason: 'analyze' } });
    expect(ledger.length).toBeGreaterThanOrEqual(1);
    expect(ledger.every((l) => l.delta === -1)).toBe(true);
    vi.unstubAllGlobals();
  });

  it('historique des crédits : recharges et analyses tracées', async () => {
    const h = await caller.documents.creditsHistory();
    expect(h.balance).toBeGreaterThanOrEqual(0);
    expect(h.rows.some((r: { reason: string }) => r.reason === 'topup')).toBe(true);
    expect(h.rows.some((r: { reason: string }) => r.reason === 'analyze')).toBe(true);
    expect(h.rows.every((r: { organizationId: string }) => r.organizationId === C.org.id)).toBe(true);
  });

  it('le structuré local prime sur l’apport IA en cas de conflit', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ totalTtc: 999 }) }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await caller.documents.creditsTopup({ amount: 1 });
    const r = await caller.documents.aiAnalyze({ text: 'Total TTC : 120,00 €' });
    expect(r.result.fields.totalTtc.value).toBe(120); // local (high) l'emporte
    vi.unstubAllGlobals();
  });
});
