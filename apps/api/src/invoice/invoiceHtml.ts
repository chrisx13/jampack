type Line = { label: string; quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown };
type Invoice = {
  number: string | null;
  docType?: string | null;
  status: string;
  issueDate: Date | null;
  dueDate: Date | null;
  validUntil?: Date | null;
  notes: string | null;
  company: { name: string } | null;
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
    ? `<div class="subro"><strong>Subrogation — affacturage.</strong> Le règlement de cette facture doit être effectué à <strong>${esc(inv.factor.name)}</strong>${inv.factor.iban ? `, IBAN <strong>${esc(inv.factor.iban)}</strong>` : ''}, subrogé dans nos droits, à qui vous devez payer valablement.</div>`
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
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2F343A; font-size: 12px; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .brand { max-width: 55%; }
  .brand .logo { max-height: 56px; margin-bottom: 8px; }
  .brand .name { font-size: 18px; font-weight: 700; color: #007D88; }
  .muted { color: #6c757d; }
  .doc { text-align: right; }
  .doc h1 { font-size: 22px; margin: 0 0 6px; letter-spacing: .04em; }
  .doc .num { font-size: 15px; font-weight: 700; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin: 12px 0 22px; }
  .box { background: #f6f8f9; border: 1px solid #e6eaec; border-radius: 8px; padding: 12px 14px; min-width: 240px; }
  .box .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #6c757d; margin-bottom: 4px; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.lines th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #6c757d; border-bottom: 2px solid #007D88; padding: 8px 8px; }
  table.lines td { padding: 8px 8px; border-bottom: 1px solid #eee; }
  .r { text-align: right; }
  .totals { width: 280px; margin-left: auto; margin-top: 14px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .ttc { border-top: 2px solid #007D88; margin-top: 6px; padding-top: 8px; font-size: 15px; font-weight: 700; }
  .subro { margin-top: 18px; border: 1px solid #ffc400; background: #fff8e1; border-radius: 8px; padding: 10px 12px; }
  .pay { margin-top: 18px; }
  .foot { margin-top: 26px; border-top: 1px solid #e6eaec; padding-top: 8px; color: #6c757d; font-size: 10px; text-align: center; }
  </style></head><body>
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
    ${inv.bankAccount ? `<div class="muted">IBAN ${esc(inv.bankAccount.iban)}${inv.bankAccount.bic ? ` · BIC ${esc(inv.bankAccount.bic)}` : ''}</div>` : ''}
    ${inv.notes ? `<div class="muted" style="margin-top:6px">${esc(inv.notes)}</div>` : ''}
    ${s(soc, 'legalMentions') ? `<div class="muted" style="margin-top:6px">${esc(s(soc, 'legalMentions'))}</div>` : ''}
  </div>

  <div class="foot">${esc(legalBits)}</div>
  </body></html>`;
}
