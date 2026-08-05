// Relevé de compte client — rendu HTML A4 : factures (+), avoirs (−) et règlements (−)
// classés par date, avec solde progressif et solde dû final.

type Entry = { date: Date | null; ref: string; type: string; debit: number; credit: number; solde: number };
type Societe = Record<string, unknown> & { name: string };

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string));
const d = (v: Date | null) => (v ? new Date(v).toLocaleDateString('fr-FR') : '—');
const s = (soc: Societe, k: string) => (soc[k] ? String(soc[k]) : '');

export function renderStatementHtml(client: string, soc: Societe, entries: Entry[], solde: number): string {
  const addr = [s(soc, 'addressLine1'), [s(soc, 'postalCode'), s(soc, 'city')].filter(Boolean).join(' ')].filter(Boolean);
  const legal = [s(soc, 'siret') && `SIRET ${s(soc, 'siret')}`, s(soc, 'tvaNumber') && `TVA ${s(soc, 'tvaNumber')}`].filter(Boolean).join(' · ');
  const rows = entries.map((e) => `<tr>
    <td>${d(e.date)}</td><td>${esc(e.ref)}</td><td>${esc(e.type)}</td>
    <td class="r">${e.debit ? euro.format(e.debit) : ''}</td>
    <td class="r">${e.credit ? euro.format(e.credit) : ''}</td>
    <td class="r">${euro.format(e.solde)}</td></tr>`).join('');

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } body { font: 13px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 0; }
    .accent { height: 5px; background: linear-gradient(90deg, #3E3A52, #6366F1, #0EA5E9); }
    .wrap { padding: 8px 4px; } h1 { font-size: 20px; margin: 0; color: #3E3A52; letter-spacing: .03em; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
    .muted { color: #6b7280; font-size: 12px; }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; min-width: 240px; }
    .lbl { text-transform: uppercase; font-size: 10px; letter-spacing: .06em; color: #9ca3af; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding: 6px 8px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; } .r { text-align: right; }
    .total { display: flex; justify-content: flex-end; margin-top: 14px; }
    .total .amt { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px; font-weight: 600; }
    .foot { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 11px; color: #9ca3af; }
  </style></head><body>
  <div class="accent"></div>
  <div class="wrap">
    <div class="head">
      <div>
        <div style="font-weight:600;font-size:15px">${esc(soc.name)}</div>
        <div class="muted">${addr.map(esc).join('<br>')}</div>
      </div>
      <div style="text-align:right">
        <h1>RELEVÉ DE COMPTE</h1>
        <div class="muted">Édité le ${d(new Date())}</div>
      </div>
    </div>
    <div class="box" style="margin-bottom:16px">
      <div class="lbl">Client</div>
      <div><strong>${esc(client)}</strong></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Pièce</th><th>Nature</th><th class="r">Débit</th><th class="r">Crédit</th><th class="r">Solde</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="muted">Aucun mouvement</td></tr>'}</tbody>
    </table>
    <div class="total"><div class="amt">Solde dû : ${euro.format(solde)}</div></div>
    <div class="foot">${esc(legal)}</div>
  </div>
  </body></html>`;
}
