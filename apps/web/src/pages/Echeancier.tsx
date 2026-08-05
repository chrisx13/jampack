import { Card, Table, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

export default function Echeancier() {
  const list = trpc.payments.echeancier.useQuery();
  const rows = list.data ?? [];
  const totalDu = rows.reduce((s, r) => s + r.remaining, 0);

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Échéancier</h4><p className="text-secondary mb-0">Factures validées non soldées</p></div>
        {rows.length > 0 && <div className="text-end"><div className="text-secondary small">Total dû</div><div className="fs-5 fw-semibold">{euro.format(totalDu)}</div></div>}
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Numéro</th><th scope="col">Client</th><th scope="col">Échéance</th><th scope="col" className="text-end">Total TTC</th><th scope="col" className="text-end">Réglé</th><th scope="col" className="text-end">Reste dû</th><th scope="col" /></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="ps-3 fw-medium">{r.number ?? '—'}</td>
                  <td>{r.company?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.dueDate)}</td>
                  <td className="text-end text-secondary">{euro.format(r.totalTtc)}</td>
                  <td className="text-end text-secondary">{euro.format(r.paid)}</td>
                  <td className="text-end fw-semibold">{euro.format(r.remaining)}</td>
                  <td className="pe-3">{r.overdue && <Badge bg="danger-subtle" text="danger" className="fw-normal">En retard</Badge>}</td>
                </tr>
              ))}
              {list.isSuccess && rows.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucune facture en attente de règlement</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
