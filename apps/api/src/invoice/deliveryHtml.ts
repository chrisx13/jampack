// Bon de livraison (BL) — rendu HTML A4 sans prix : désignation + quantités, adresse de
// livraison et cartouche de signature. Dérivé d'une facture (mêmes lignes).

type Line = { label: string; quantity: unknown };
type Doc = {
  deliveryNumber: string | null;
  number: string | null;               // facture rattachée
  deliveredAt: Date | null;
  customerReference?: string | null;
  company: { name: string } | null;
  establishment: { name?: string | null; addressLine1?: string | null; postalCode?: string | null; city?: string | null } | null;
  lines: Line[];
};
type Societe = Record<string, unknown> & { name: string };

const n = (v: unknown) => { const x = Number(v as never); return Number.isFinite(x) ? x : 0; };
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string));
const d = (v: Date | null) => (v ? new Date(v).toLocaleDateString('fr-FR') : '—');
const s = (soc: Societe, k: string) => (soc[k] ? String(soc[k]) : '');

export function renderDeliveryHtml(doc: Doc, soc: Societe): string {
  const addr = [s(soc, 'addressLine1'), [s(soc, 'postalCode'), s(soc, 'city')].filter(Boolean).join(' ')].filter(Boolean);
  const est = doc.establishment;
  const clientAddr = est ? [est.addressLine1, [est.postalCode, est.city].filter(Boolean).join(' ')].filter(Boolean) : [];
  const legalBits = [
    s(soc, 'legalForm') && `${s(soc, 'legalForm')}${s(soc, 'capital') ? ` au capital de ${s(soc, 'capital')}` : ''}`,
    s(soc, 'siret') && `SIRET ${s(soc, 'siret')}`,
    s(soc, 'tvaNumber') && `TVA ${s(soc, 'tvaNumber')}`,
  ].filter(Boolean).join(' · ');
  const rows = doc.lines.map((l) => `<tr><td>${esc(l.label)}</td><td class="r">${n(l.quantity).toLocaleString('fr-FR')}</td></tr>`).join('');

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } body { font: 13px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 0; }
    .accent { height: 5px; background: linear-gradient(90deg, #3E3A52, #6366F1, #0EA5E9); }
    .wrap { padding: 8px 4px; } h1 { font-size: 22px; margin: 0; letter-spacing: .04em; color: #3E3A52; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
    .muted { color: #6b7280; font-size: 12px; } .num { font-weight: 600; }
    .parties { display: flex; justify-content: space-between; gap: 16px; margin: 14px 0 20px; }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; min-width: 250px; }
    .lbl { text-transform: uppercase; font-size: 10px; letter-spacing: .06em; color: #9ca3af; margin-bottom: 4px; }
    table.lines { width: 100%; border-collapse: collapse; margin-top: 6px; }
    table.lines th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding: 6px 8px; }
    table.lines td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; } .r { text-align: right; }
    .sign { margin-top: 40px; display: flex; justify-content: flex-end; }
    .sign .cartouche { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; min-width: 260px; }
    .foot { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 11px; color: #9ca3af; }
  </style></head><body>
  <div class="accent"></div>
  <div class="wrap">
    <div class="head">
      <div>
        <div style="font-weight:600;font-size:15px">${esc(soc.name)}</div>
        <div class="muted">${addr.map(esc).join('<br>')}</div>
      </div>
      <div style="text-align:right">
        <h1>BON DE LIVRAISON</h1>
        <div class="num">${esc(doc.deliveryNumber ?? '—')}</div>
        <div class="muted">Date de livraison : ${d(doc.deliveredAt)}</div>
        ${doc.number ? `<div class="muted">Facture : ${esc(doc.number)}</div>` : ''}
        ${doc.customerReference ? `<div class="muted">Réf. commande : ${esc(doc.customerReference)}</div>` : ''}
      </div>
    </div>

    <div class="parties">
      <div></div>
      <div class="box">
        <div class="lbl">Livré à</div>
        <div><strong>${esc(doc.company?.name ?? '')}</strong></div>
        <div class="muted">${clientAddr.map(esc).join('<br>')}</div>
      </div>
    </div>

    <table class="lines">
      <thead><tr><th>Désignation</th><th class="r">Quantité</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="2" class="muted">Aucune ligne</td></tr>'}</tbody>
    </table>

    <div class="sign">
      <div class="cartouche">
        <div style="font-size:.9em"><strong>Reçu conforme</strong> — date et signature du client</div>
        <div class="muted" style="font-size:.8em;margin-top:4px">(réserves éventuelles à préciser ci-dessous)</div>
        <div style="height:52px"></div>
      </div>
    </div>

    <div class="foot">${esc(legalBits)}</div>
  </div>
  </body></html>`;
}
