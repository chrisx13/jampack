import { Card, Table, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const cell = (v: number) => (v > 0.005 ? euro.format(v) : <span className="text-secondary">—</span>);

export default function AgedReceivables() {
  const q = trpc.analytics.agedReceivables.useQuery();
  const d = q.data;

  if (q.isLoading || !d) return <div className="text-center py-5"><Spinner /></div>;

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Balance âgée clients</h4><p className="text-secondary mb-0">Créances non soldées par tranche d'ancienneté (échéance dépassée)</p></div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr>
                <th className="ps-3">Client</th>
                <th className="text-end">Non échu</th>
                <th className="text-end">1–30 j</th>
                <th className="text-end">31–60 j</th>
                <th className="text-end">61–90 j</th>
                <th className="text-end">+90 j</th>
                <th className="text-end pe-3">Total dû</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
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
              {d.rows.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucune créance en cours</td></tr>}
            </tbody>
            {d.rows.length > 0 && (
              <tfoot>
                <tr className="fw-semibold border-top">
                  <td className="ps-3">Total</td>
                  <td className="text-end">{euro.format(d.totals.notDue)}</td>
                  <td className="text-end">{euro.format(d.totals.d1_30)}</td>
                  <td className="text-end">{euro.format(d.totals.d31_60)}</td>
                  <td className="text-end">{euro.format(d.totals.d61_90)}</td>
                  <td className="text-end text-danger">{euro.format(d.totals.d90p)}</td>
                  <td className="text-end pe-3">{euro.format(d.totals.total)}</td>
                </tr>
              </tfoot>
            )}
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
