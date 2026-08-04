import { Card, Table, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

export default function OverduePurchaseOrders() {
  const q = trpc.purchases.orders.overdue.useQuery();
  const rows = q.data ?? [];

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Commandes en retard</h4><p className="text-secondary mb-0">Commandes envoyées non réceptionnées dont la date de livraison prévue est dépassée</p></div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Commande</th><th>Fournisseur</th><th>Livraison prévue</th><th className="text-center">Retard</th><th className="text-end pe-3">Montant HT</th></tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="ps-3 fw-medium">{r.number ?? '—'}</td>
                  <td>{r.supplier?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.expectedDate)}</td>
                  <td className="text-center"><Badge bg={r.daysLate >= 15 ? 'danger-subtle' : 'warning-subtle'} text={r.daysLate >= 15 ? 'danger' : 'warning'} className="fw-normal">{r.daysLate} j</Badge></td>
                  <td className="text-end pe-3 fw-semibold">{euro.format(r.totalHt)}</td>
                </tr>
              ))}
              {q.isSuccess && rows.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucune commande en retard 🎉</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
