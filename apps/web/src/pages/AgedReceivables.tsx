import { Card, Table, Spinner, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const cell = (v: number) => (v > 0.005 ? euro.format(v) : <span className="text-secondary">—</span>);
const fr = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

type Bucket = { notDue: number; d1_30: number; d31_60: number; d61_90: number; d90p: number; total: number };
type AgedData = { rows: (Bucket & { company: string })[]; totals: Bucket };

function AgedTable({ title, party, data }: { title: string; party: string; data?: AgedData }) {
  if (!data) return <div className="text-center py-4"><Spinner size="sm" /></div>;
  return (
    <Card className="mb-4">
      <Card.Header className="fw-semibold bg-transparent">{title}</Card.Header>
      <Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small">
            <tr>
              <th scope="col" className="ps-3">{party}</th>
              <th scope="col" className="text-end">Non échu</th><th scope="col" className="text-end">1–30 j</th><th scope="col" className="text-end">31–60 j</th>
              <th scope="col" className="text-end">61–90 j</th><th scope="col" className="text-end">+90 j</th><th scope="col" className="text-end pe-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.company}>
                <td className="ps-3 fw-medium">{r.company}</td>
                <td className="text-end">{cell(r.notDue)}</td>
                <td className="text-end">{cell(r.d1_30)}</td>
                <td className="text-end text-warning">{cell(r.d31_60)}</td>
                <td className="text-end text-warning">{cell(r.d61_90)}</td>
                <td className="text-end text-danger fw-medium">{cell(r.d90p)}</td>
                <td className="text-end pe-3 fw-semibold">{euro.format(r.total)}</td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucun montant en cours</td></tr>}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot>
              <tr className="fw-semibold border-top">
                <td className="ps-3">Total</td>
                <td className="text-end">{euro.format(data.totals.notDue)}</td>
                <td className="text-end">{euro.format(data.totals.d1_30)}</td>
                <td className="text-end">{euro.format(data.totals.d31_60)}</td>
                <td className="text-end">{euro.format(data.totals.d61_90)}</td>
                <td className="text-end text-danger">{euro.format(data.totals.d90p)}</td>
                <td className="text-end pe-3">{euro.format(data.totals.total)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      </Card.Body>
    </Card>
  );
}

export default function AgedReceivables() {
  const receiv = trpc.analytics.agedReceivables.useQuery();
  const pay = trpc.analytics.agedPayables.useQuery();

  const exportCsv = () => {
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines: string[] = ['Type;Tiers;Non échu;1-30 j;31-60 j;61-90 j;+90 j;Total'];
    const push = (type: string, d?: AgedData) => (d?.rows ?? []).forEach((r) => lines.push([type, esc(r.company), fr(r.notDue), fr(r.d1_30), fr(r.d31_60), fr(r.d61_90), fr(r.d90p), fr(r.total)].join(';')));
    push('Créance client', receiv.data);
    push('Dette fournisseur', pay.data);
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'balance-agee.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const hasData = (receiv.data?.rows.length ?? 0) + (pay.data?.rows.length ?? 0) > 0;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div><h4 className="mb-1 fw-semibold">Balance âgée</h4><p className="text-secondary mb-0">Créances clients et dettes fournisseurs par tranche d'ancienneté</p></div>
        {hasData && <Button variant="light" title="Exporter en CSV" onClick={exportCsv}><i className="bi bi-filetype-csv me-1" aria-hidden="true" />CSV</Button>}
      </div>
      <AgedTable title="Créances clients" party="Client" data={receiv.data} />
      <AgedTable title="Dettes fournisseurs" party="Fournisseur" data={pay.data} />
    </>
  );
}
