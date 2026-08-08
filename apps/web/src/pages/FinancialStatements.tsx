import { Card, Table, Spinner, Row, Col, Badge, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fr = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

function Lines({ rows }: { rows: { code: string; name: string; amount: number }[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.code}>
          <td className="ps-3 text-secondary small" style={{ width: 90 }}>{r.code}</td>
          <td>{r.name}</td>
          <td className="text-end pe-3">{euro.format(r.amount)}</td>
        </tr>
      ))}
      {rows.length === 0 && <tr><td colSpan={3} className="text-center text-secondary py-3">—</td></tr>}
    </>
  );
}

export default function FinancialStatements() {
  const cr = trpc.accounting.incomeStatement.useQuery();
  const bs = trpc.accounting.balanceSheet.useQuery();

  const exportCsv = () => {
    if (!cr.data || !bs.data) return;
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const head = 'État;Rubrique;Code;Libellé;Montant';
    const rows: string[] = [];
    const push = (etat: string, rubrique: string, l: { code: string; name: string; amount: number }) => rows.push([etat, rubrique, esc(l.code), esc(l.name), fr(l.amount)].join(';'));
    cr.data.produits.forEach((l) => push('Compte de résultat', 'Produits', l));
    cr.data.charges.forEach((l) => push('Compte de résultat', 'Charges', l));
    rows.push(['Compte de résultat', 'Résultat', '', cr.data.resultat >= 0 ? 'Bénéfice' : 'Perte', fr(cr.data.resultat)].join(';'));
    bs.data.actif.forEach((l) => push('Bilan', 'Actif', l));
    bs.data.passif.forEach((l) => push('Bilan', 'Passif', l));
    rows.push(['Bilan', 'Résultat', '', 'Résultat de l’exercice', fr(bs.data.resultat)].join(';'));
    const url = URL.createObjectURL(new Blob([[head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'etats-financiers.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
        <div><h4 className="mb-1 fw-semibold">États financiers</h4><p className="text-secondary mb-0">Compte de résultat et bilan simplifié (PCG), dérivés de la balance générale</p></div>
        {cr.data && bs.data && <Button variant="light" size="sm" title="Exporter en CSV" onClick={exportCsv}><i className="bi bi-filetype-csv me-1" aria-hidden="true" />CSV</Button>}
      </div>

      <Row className="g-3">
        <Col xl={6}>
          <Card className="h-100">
            <Card.Header className="bg-transparent fw-semibold d-flex justify-content-between align-items-center">
              <span>Compte de résultat</span>
              {cr.data && <Badge bg={cr.data.resultat >= 0 ? 'success-subtle' : 'danger-subtle'} text={cr.data.resultat >= 0 ? 'success' : 'danger'} className="fw-normal">Résultat {euro.format(cr.data.resultat)}</Badge>}
            </Card.Header>
            <Card.Body className="p-0">
              {cr.isLoading && <div className="text-center py-4"><Spinner size="sm" /></div>}
              {cr.data && (
                <Table size="sm" className="mb-0 align-middle">
                  <tbody>
                    <tr className="table-light"><td className="ps-3 fw-semibold" colSpan={2}>Produits (classe 7)</td><td className="text-end pe-3 fw-semibold">{euro.format(cr.data.totalProduits)}</td></tr>
                    <Lines rows={cr.data.produits} />
                    <tr className="table-light"><td className="ps-3 fw-semibold" colSpan={2}>Charges (classe 6)</td><td className="text-end pe-3 fw-semibold">{euro.format(cr.data.totalCharges)}</td></tr>
                    <Lines rows={cr.data.charges} />
                    <tr className="border-top border-2"><td className="ps-3 fw-bold" colSpan={2}>{cr.data.resultat >= 0 ? 'Bénéfice' : 'Perte'}</td><td className={`text-end pe-3 fw-bold ${cr.data.resultat >= 0 ? 'text-success' : 'text-danger'}`}>{euro.format(cr.data.resultat)}</td></tr>
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xl={6}>
          <Card className="h-100">
            <Card.Header className="bg-transparent fw-semibold d-flex justify-content-between align-items-center">
              <span>Bilan simplifié</span>
              {bs.data && <Badge bg={bs.data.equilibre ? 'success-subtle' : 'danger-subtle'} text={bs.data.equilibre ? 'success' : 'danger'} className="fw-normal">{bs.data.equilibre ? 'Équilibré' : 'Déséquilibré'}</Badge>}
            </Card.Header>
            <Card.Body className="p-0">
              {bs.isLoading && <div className="text-center py-4"><Spinner size="sm" /></div>}
              {bs.data && (
                <Table size="sm" className="mb-0 align-middle">
                  <tbody>
                    <tr className="table-light"><td className="ps-3 fw-semibold" colSpan={2}>Actif</td><td className="text-end pe-3 fw-semibold">{euro.format(bs.data.totalActif)}</td></tr>
                    <Lines rows={bs.data.actif} />
                    <tr className="table-light"><td className="ps-3 fw-semibold" colSpan={2}>Passif</td><td className="text-end pe-3 fw-semibold">{euro.format(bs.data.totalPassif)}</td></tr>
                    <Lines rows={bs.data.passif} />
                    <tr><td className="ps-3 text-secondary small" style={{ width: 90 }}>—</td><td>Résultat de l'exercice</td><td className={`text-end pe-3 ${bs.data.resultat >= 0 ? 'text-success' : 'text-danger'}`}>{euro.format(bs.data.resultat)}</td></tr>
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <p className="text-secondary small mt-3 mb-0">Présentation simplifiée à vocation de gestion — ne se substitue pas à la liasse fiscale établie par votre expert-comptable.</p>
    </>
  );
}
