import { lmePaymentMention, discountMention, VAT_FRANCHISE_MENTION, VAT_REVERSE_CHARGE_MENTION, VAT_ON_PAYMENTS_MENTION, formatIban } from '@jampack/domain';

type Line = { label: string; quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown };
type Invoice = {
  number: string | null;
  docType?: string | null;
  status: string;
  issueDate: Date | null;
  dueDate: Date | null;
  validUntil?: Date | null;
  vatReverseCharge?: boolean | null;
  customerReference?: string | null;
  notes: string | null;
  company: { name: string; siren?: string | null; siret?: string | null; tvaNumber?: string | null } | null;
  establishment: { name?: string | null; addressLine1?: string | null; postalCode?: string | null; city?: string | null } | null;
  factor?: { name: string; iban?: string | null } | null;
  bankAccount?: { iban: string; bic?: string | null } | null;
  paymentTerm?: { label: string } | null;
  lines: Line[];
};

const DOC_TITLES: Record<string, string> = { devis: 'DEVIS', facture: 'FACTURE', avoir: 'AVOIR' };
type Societe = Record<string, unknown> & { name: string };
type Totals = { totalHt: number; totalTva: number; totalTtc: number };

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const n = (v: unknown) => { const x = Number(v as never); return Number.isFinite(x) ? x : 0; };
const d = (v: Date | null) => (v ? new Date(v).toLocaleDateString('fr-FR') : '—');
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const s = (soc: Societe, k: string) => (soc[k] ? String(soc[k]) : '');

/** Mini-logo JAMPACK (attribution produit, pied de page). */
const PRODUCT_MARK = '<svg width="13" height="13" viewBox="0 0 40 40" style="vertical-align:-2px"><defs><linearGradient id="fm" x1="10" y1="30" x2="30" y2="10" gradientUnits="userSpaceOnUse"><stop stop-color="#6366F1"/><stop offset="1" stop-color="#0EA5E9"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="#3E3A52"/><g fill="url(#fm)"><rect x="10.4" y="21" width="4.6" height="8" rx="2.3"/><rect x="17.7" y="15" width="4.6" height="14" rx="2.3"/><rect x="25" y="10.6" width="4.6" height="18.4" rx="2.3"/></g></svg>';

/** Rendu HTML A4 d'une pièce de vente (devis / facture / avoir). */
export function renderDocHtml(inv: Invoice, soc: Societe, totals: Totals): string {
  const docType = inv.docType ?? 'facture';
  const base = DOC_TITLES[docType] ?? 'FACTURE';
  const title = inv.status === 'draft' ? `${base} (BROUILLON)` : base;
  const secondDate = docType === 'devis'
    ? { lbl: 'Validité', val: inv.validUntil ?? null }
    : docType === 'avoir'
      ? null
      : { lbl: 'Échéance', val: inv.dueDate ?? null };
  const showSubrogation = docType === 'facture';
  const addr = [s(soc, 'addressLine1'), s(soc, 'addressLine2'), [s(soc, 'postalCode'), s(soc, 'city')].filter(Boolean).join(' ')].filter(Boolean);
  const contact = [s(soc, 'phone') && `Tél. ${s(soc, 'phone')}`, s(soc, 'email'), s(soc, 'website')].filter(Boolean);
  const est = inv.establishment;
  const clientAddr = est ? [est.addressLine1, [est.postalCode, est.city].filter(Boolean).join(' ')].filter(Boolean) : [];

  const legalBits = [
    s(soc, 'legalForm') && `${s(soc, 'legalForm')}${s(soc, 'capital') ? ` au capital de ${s(soc, 'capital')}` : ''}`,
    s(soc, 'siret') && `SIRET ${s(soc, 'siret')}`,
    s(soc, 'tvaNumber') && `TVA ${s(soc, 'tvaNumber')}`,
    s(soc, 'rcs') && `RCS ${s(soc, 'rcs')}`,
    s(soc, 'ape') && `APE ${s(soc, 'ape')}`,
  ].filter(Boolean).join(' · ');

  const subrogation = showSubrogation && inv.factor
    ? `<div class="subro"><strong>Subrogation — affacturage.</strong> Le règlement de cette facture doit être effectué à <strong>${esc(inv.factor.name)}</strong>${inv.factor.iban ? `, IBAN <strong>${esc(formatIban(inv.factor.iban))}</strong>` : ''}, subrogé dans nos droits, à qui vous devez payer valablement.</div>`
    : '';

  const rows = inv.lines.map((l) => {
    const ht = n(l.quantity) * n(l.unitPriceHt);
    return `<tr>
      <td>${esc(l.label)}</td>
      <td class="r">${n(l.quantity).toLocaleString('fr-FR')}</td>
      <td class="r">${eur.format(n(l.unitPriceHt))}</td>
      <td class="r">${n(l.taxRatePct)} %</td>
      <td class="r">${eur.format(ht)}</td>
    </tr>`;
  }).join('');

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; font-size: 12px; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .accent { height: 5px; background: linear-gradient(90deg, #3E3A52, #6366F1, #0EA5E9); }
  .wrap { padding: 34px 40px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; }
  .brand { max-width: 55%; }
  .brand .logo { max-height: 52px; margin-bottom: 8px; }
  .brand .name { font-size: 18px; font-weight: 700; color: #0F172A; letter-spacing: -.01em; }
  .muted { color: #64748B; }
  .doc { text-align: right; }
  .doc h1 { font-size: 22px; margin: 0 0 6px; letter-spacing: .08em; color: #4F46E5; font-weight: 700; }
  .doc .num { font-size: 15px; font-weight: 700; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin: 12px 0 22px; }
  .box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; min-width: 240px; }
  .box .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748B; margin-bottom: 4px; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.lines th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #475569; border-bottom: 2px solid #4F46E5; padding: 9px 8px; }
  table.lines td { padding: 9px 8px; border-bottom: 1px solid #EEF2F7; }
  .r { text-align: right; }
  .totals { width: 290px; margin-left: auto; margin-top: 14px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .ttc { border-top: 2px solid #4F46E5; margin-top: 6px; padding-top: 9px; font-size: 15px; font-weight: 700; color: #0F172A; }
  .subro { margin-top: 18px; border: 1px solid #F59E0B; background: #FFFBEB; border-radius: 10px; padding: 10px 12px; }
  .pay { margin-top: 18px; }
  .foot { margin-top: 26px; border-top: 1px solid #E2E8F0; padding-top: 10px; color: #94A3B8; font-size: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .foot .made { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  </style></head><body>
  <div class="accent"></div>
  <div class="wrap">
  <div class="head">
    <div class="brand">
      ${s(soc, 'logoUrl') ? `<img class="logo" src="${esc(s(soc, 'logoUrl'))}" />` : ''}
      <div class="name">${esc(soc.name)}</div>
      <div class="muted">${addr.map(esc).join('<br>')}</div>
      <div class="muted">${contact.map(esc).join(' · ')}</div>
    </div>
    <div class="doc">
      <h1>${title}</h1>
      <div class="num">${esc(inv.number ?? '—')}</div>
      <div class="muted">Émission : ${d(inv.issueDate)}</div>
      ${secondDate ? `<div class="muted">${secondDate.lbl} : ${d(secondDate.val)}</div>` : ''}
    </div>
  </div>

  <div class="parties">
    <div></div>
    <div class="box">
      <div class="lbl">Facturé à</div>
      <div><strong>${esc(inv.company?.name ?? '')}</strong></div>
      <div class="muted">${clientAddr.map(esc).join('<br>')}</div>
      <div class="muted">${[inv.company?.siret && `SIRET ${esc(inv.company.siret)}`, inv.company?.tvaNumber && `TVA ${esc(inv.company.tvaNumber)}`].filter(Boolean).join(' · ')}</div>
      ${inv.customerReference ? `<div class="muted" style="margin-top:4px"><strong>Réf. commande :</strong> ${esc(inv.customerReference)}</div>` : ''}
    </div>
  </div>

  <table class="lines">
    <thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">PU HT</th><th class="r">TVA</th><th class="r">Total HT</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="muted">Aucune ligne</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div><span class="muted">Total HT</span><span>${eur.format(totals.totalHt)}</span></div>
    <div><span class="muted">TVA</span><span>${eur.format(totals.totalTva)}</span></div>
    <div class="ttc"><span>Total TTC</span><span>${eur.format(totals.totalTtc)}</span></div>
  </div>

  ${subrogation}

  <div class="pay">
    ${inv.paymentTerm ? `<div><strong>Conditions de paiement :</strong> ${esc(inv.paymentTerm.label)}</div>` : ''}
    ${inv.bankAccount ? `<div class="muted">IBAN ${esc(formatIban(inv.bankAccount.iban))}${inv.bankAccount.bic ? ` · BIC ${esc(inv.bankAccount.bic)}` : ''}</div>` : ''}
    ${inv.notes ? `<div class="muted" style="margin-top:6px">${esc(inv.notes)}</div>` : ''}
    ${soc.vatFranchise ? `<div class="muted" style="margin-top:6px"><strong>${esc(VAT_FRANCHISE_MENTION)}</strong></div>` : ''}
    ${inv.vatReverseCharge ? `<div class="muted" style="margin-top:6px"><strong>${esc(VAT_REVERSE_CHARGE_MENTION)}</strong></div>` : ''}
    ${soc.vatOnPayments && docType === 'facture' ? `<div class="muted" style="margin-top:6px">${esc(VAT_ON_PAYMENTS_MENTION)}</div>` : ''}
    ${docType === 'facture' ? `<div class="muted" style="margin-top:6px">${esc(lmePaymentMention(s(soc, 'penaltyRate')))}</div>` : ''}
    ${docType === 'facture' ? `<div class="muted" style="margin-top:6px">${esc(discountMention(s(soc, 'discountTerms')))}</div>` : ''}
    ${s(soc, 'legalMentions') ? `<div class="muted" style="margin-top:6px">${esc(s(soc, 'legalMentions'))}</div>` : ''}
  </div>

  ${docType === 'devis' ? `<div class="pay">
    ${inv.validUntil ? `<div><strong>Validité :</strong> devis valable jusqu'au ${d(inv.validUntil)}.</div>` : ''}
    ${s(soc, 'cgv') ? `<div class="muted" style="margin-top:6px">${esc(s(soc, 'cgv'))}</div>` : ''}
    <div style="margin-top:14px;display:flex;justify-content:flex-end">
      <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;min-width:250px">
        <div style="font-size:.82rem"><strong>Bon pour accord</strong> — date et signature du client</div>
        <div class="muted" style="font-size:.72rem;margin-top:4px">(à faire précéder de la mention manuscrite « Bon pour accord »)</div>
        <div style="height:46px"></div>
      </div>
    </div>
  </div>` : ''}

  <div class="foot">
    <span>${esc(legalBits)}</span>
    <span class="made">${PRODUCT_MARK}Édité avec JAMPACK</span>
  </div>
  </div>
  </body></html>`;
}
