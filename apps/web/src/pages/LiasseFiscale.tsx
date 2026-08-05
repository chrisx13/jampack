import { Card, Table, Spinner, Alert, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fr = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

/**
 * Liasse fiscale (préparation) : présente le bilan et le compte de résultat (déjà calculés) qui
 * alimentent la liasse, avec avertissements. JAMPACK ne remplit pas les CERFA officiels ni ne
 * télétransmet (EDI-TDFC) : cela relève d'un expert-comptable ou d'un service payant (ex. Teledec).
 */
// Regroupe les comptes de charges/produits (cl. 6/7) en postes standard du compte de résultat
// simplifié (esprit 2033-B). Regroupement par racine PCG — ne préjuge pas des codes de cases CERFA.
function simplifiedResult(income?: { charges: { code: string; amount: number }[]; produits: { code: string; amount: number }[] }) {
  if (!income) return null;
  const sum = (rows: { code: string; amount: number }[], pred: (c: string) => boolean) =>
    Math.round(rows.filter((r) => pred(r.code)).reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const p2 = (c: string) => c.slice(0, 2);
  return {
    ca: sum(income.produits, (c) => c.startsWith('70')),
    autresProduits: sum(income.produits, (c) => !c.startsWith('70')),
    achats: sum(income.charges, (c) => c.startsWith('60')),
    chargesExternes: sum(income.charges, (c) => ['61', '62'].includes(p2(c))),
    impotsTaxes: sum(income.charges, (c) => c.startsWith('63')),
    personnel: sum(income.charges, (c) => c.startsWith('64')),
    dotations: sum(income.charges, (c) => c.startsWith('68')),
    autresCharges: sum(income.charges, (c) => ['65', '66', '67', '69'].includes(p2(c))),
  };
}

export default function LiasseFiscale() {
  const income = trpc.accounting.incomeStatement.useQuery();
  const balance = trpc.accounting.balanceSheet.useQuery();
  const loading = income.isLoading || balance.isLoading;
  const simpl = simplifiedResult(income.data);

  const exportCsv = () => {
    const b = balance.data, i = income.data;
    if (!b || !i) return;
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines: string[] = ['Section;Compte;Libellé;Montant'];
    for (const a of b.actif) lines.push(['Bilan actif', a.code, esc(a.name), fr(a.amount)].join(';'));
    for (const p of b.passif) lines.push(['Bilan passif', p.code, esc(p.name), fr(p.amount)].join(';'));
    lines.push(['Bilan passif', '', 'Résultat de l’exercice', fr(b.resultat)].join(';'));
    for (const p of i.produits) lines.push(['Produits', p.code, esc(p.name), fr(p.amount)].join(';'));
    for (const c of i.charges) lines.push(['Charges', c.code, esc(c.name), fr(c.amount)].join(';'));
    lines.push(['Résultat', '', 'Résultat comptable', fr(i.resultat)].join(';'));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'liasse-preparation.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div><h4 className="mb-1 fw-semibold">Liasse fiscale (préparation)</h4><p className="text-secondary mb-0">Bilan et compte de résultat qui alimentent la liasse — à confier à un expert-comptable</p></div>
        <Button variant="light" title="Exporter (CSV)" disabled={loading} onClick={exportCsv}><i className="bi bi-filetype-csv me-1" aria-hidden="true" />Export</Button>
      </div>

      <Alert variant="warning">
        <div className="fw-semibold mb-1"><i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />Avant d'utiliser cette option</div>
        <ul className="mb-0 small">
          <li><strong>Rien ne remplace un expert-comptable</strong> : le résultat <em>fiscal</em> (réintégrations/déductions,
            régimes, crédits d'impôt) ne se déduit pas automatiquement de la comptabilité et engage votre responsabilité.</li>
          <li>La <strong>télétransmission</strong> de la liasse via un service comme <strong>Teledec est payante</strong>
            (tarif fixé par l'éditeur du service). JAMPACK ne facture pas ce service et ne remplit pas les CERFA
            officiels (2050…, 2033…) ni n'assure l'envoi EDI-TDFC à la DGFiP.</li>
        </ul>
      </Alert>

      {loading && <div className="text-center py-5"><Spinner /></div>}

      {balance.data && (
        <Card className="mb-3"><Card.Body>
          <h6 className="fw-semibold mb-3">Bilan</h6>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="text-secondary small text-uppercase mb-1">Actif</div>
              <Table size="sm" className="mb-1"><tbody>
                {balance.data.actif.map((a) => <tr key={a.code}><td className="text-secondary">{a.code}</td><td>{a.name}</td><td className="text-end">{euro.format(a.amount)}</td></tr>)}
              </tbody></Table>
              <div className="d-flex justify-content-between fw-semibold border-top pt-1"><span>Total actif</span><span>{euro.format(balance.data.totalActif)}</span></div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small text-uppercase mb-1">Passif</div>
              <Table size="sm" className="mb-1"><tbody>
                {balance.data.passif.map((p) => <tr key={p.code}><td className="text-secondary">{p.code}</td><td>{p.name}</td><td className="text-end">{euro.format(p.amount)}</td></tr>)}
                <tr><td /><td className="fst-italic">Résultat de l'exercice</td><td className="text-end">{euro.format(balance.data.resultat)}</td></tr>
              </tbody></Table>
              <div className="d-flex justify-content-between fw-semibold border-top pt-1"><span>Total passif</span><span>{euro.format(balance.data.totalPassif)}</span></div>
            </div>
          </div>
          {!balance.data.equilibre && <Alert variant="danger" className="py-2 mt-2 mb-0 small">Bilan déséquilibré — vérifiez les écritures avant toute déclaration.</Alert>}
        </Card.Body></Card>
      )}

      {income.data && (
        <Card><Card.Body>
          <h6 className="fw-semibold mb-3">Compte de résultat</h6>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="text-secondary small text-uppercase mb-1">Charges</div>
              <Table size="sm" className="mb-1"><tbody>
                {income.data.charges.map((c) => <tr key={c.code}><td className="text-secondary">{c.code}</td><td>{c.name}</td><td className="text-end">{euro.format(c.amount)}</td></tr>)}
              </tbody></Table>
              <div className="d-flex justify-content-between fw-semibold border-top pt-1"><span>Total charges</span><span>{euro.format(income.data.totalCharges)}</span></div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small text-uppercase mb-1">Produits</div>
              <Table size="sm" className="mb-1"><tbody>
                {income.data.produits.map((p) => <tr key={p.code}><td className="text-secondary">{p.code}</td><td>{p.name}</td><td className="text-end">{euro.format(p.amount)}</td></tr>)}
              </tbody></Table>
              <div className="d-flex justify-content-between fw-semibold border-top pt-1"><span>Total produits</span><span>{euro.format(income.data.totalProduits)}</span></div>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
            <span className="fw-semibold">Résultat comptable {income.data.resultat >= 0 ? '(bénéfice)' : '(perte)'}</span>
            <span className={`fw-semibold fs-5 ${income.data.resultat >= 0 ? 'text-success' : 'text-danger'}`}>{euro.format(income.data.resultat)}</span>
          </div>
          <p className="text-secondary small mt-2 mb-0">Le <strong>résultat fiscal</strong> (imprimé 2058-A / 2033-B) se calcule à partir de ce résultat comptable après réintégrations et déductions — <strong>à établir avec un expert-comptable</strong>.</p>
        </Card.Body></Card>
      )}

      {simpl && income.data && (
        <Card className="mt-3"><Card.Body>
          <h6 className="fw-semibold mb-1">Compte de résultat simplifié — agrégats (esprit 2033-B)</h6>
          <p className="text-secondary small">Regroupement des comptes par racine PCG. <strong>Valeurs proposées, à vérifier</strong> ; ne préjuge pas des codes de cases officiels du CERFA (à renseigner d'après la notice DGFiP / par l'expert-comptable).</p>
          <Table size="sm" className="mb-0">
            <tbody>
              <tr><td>Chiffre d'affaires (ventes, cl. 70)</td><td className="text-end">{euro.format(simpl.ca)}</td></tr>
              <tr><td>Autres produits (cl. 71–79)</td><td className="text-end">{euro.format(simpl.autresProduits)}</td></tr>
              <tr className="border-top"><td>Achats (cl. 60)</td><td className="text-end">{euro.format(simpl.achats)}</td></tr>
              <tr><td>Charges externes (cl. 61–62)</td><td className="text-end">{euro.format(simpl.chargesExternes)}</td></tr>
              <tr><td>Impôts &amp; taxes (cl. 63)</td><td className="text-end">{euro.format(simpl.impotsTaxes)}</td></tr>
              <tr><td>Charges de personnel (cl. 64)</td><td className="text-end">{euro.format(simpl.personnel)}</td></tr>
              <tr><td>Dotations amortissements/provisions (cl. 68)</td><td className="text-end">{euro.format(simpl.dotations)}</td></tr>
              <tr><td>Autres charges (cl. 65–67, 69)</td><td className="text-end">{euro.format(simpl.autresCharges)}</td></tr>
              <tr className="border-top fw-semibold"><td>Résultat comptable</td><td className={`text-end ${income.data.resultat >= 0 ? 'text-success' : 'text-danger'}`}>{euro.format(income.data.resultat)}</td></tr>
            </tbody>
          </Table>
        </Card.Body></Card>
      )}
    </>
  );
}
