import { Card, Table, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const qfmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });

export default function StockValuation() {
  const val = trpc.stock.valuation.useQuery();
  const rows = val.data?.rows ?? [];

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Valorisation du stock</h4><p className="text-secondary mb-0">Au prix moyen pondéré (PMP) des entrées</p></div>
        {rows.length > 0 && <div className="text-end"><div className="text-secondary small">Valeur totale</div><div className="fs-5 fw-semibold">{euro.format(val.data?.total ?? 0)}</div></div>}
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Article</th><th>Référence</th><th className="text-end">Quantité</th><th className="text-end">PMP</th><th className="text-end pe-3">Valeur</th></tr>
            </thead>
            <tbody>
              {val.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={r.productId}>
                  <td className="ps-3 fw-medium">{r.productName}</td>
                  <td className="text-secondary">{r.reference ?? '—'}</td>
                  <td className="text-end">{qfmt(r.quantity)} <span className="text-secondary small">{r.unit}</span></td>
                  <td className="text-end text-secondary">{euro.format(r.pmp)}</td>
                  <td className="text-end pe-3 fw-semibold">{euro.format(r.value)}</td>
                </tr>
              ))}
              {val.isSuccess && rows.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucun stock valorisé</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
