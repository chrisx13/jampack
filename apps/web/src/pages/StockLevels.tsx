import { Card, Table, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';

const qfmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });

export default function StockLevels() {
  const levels = trpc.stock.levels.useQuery();
  const rows = levels.data ?? [];

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Niveaux de stock</h4><p className="text-secondary mb-0">Quantités nettes par article et entrepôt</p></div>
      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Article</th><th>Référence</th><th>Entrepôt</th><th className="text-end pe-3">Quantité</th></tr>
            </thead>
            <tbody>
              {levels.isLoading && <tr><td colSpan={4} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={`${r.productId}-${r.warehouseId}`}>
                  <td className="ps-3 fw-medium">{r.productName}</td>
                  <td className="text-secondary">{r.reference ?? '—'}</td>
                  <td>{r.warehouseName}</td>
                  <td className={`text-end pe-3 fw-semibold ${r.quantity < 0 ? 'text-danger' : ''}`}>{qfmt(r.quantity)} <span className="text-secondary fw-normal small">{r.unit}</span></td>
                </tr>
              ))}
              {levels.isSuccess && rows.length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-4">Aucun mouvement de stock enregistré</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
