import { Card, Table, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

type Row = { id: string; number: string | null; company: { name: string } | null; validUntil: string | null; totalTtc: number; daysToExpiry: number | null; expired: boolean };

export default function QuotesExpiring() {
  // `expiring` est une procédure « extra » de makeSalesRouter (non exposée dans le type web) — accès dynamique.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (trpc as any).quotes.expiring.useQuery();
  const rows: Row[] = q.data ?? [];

  const badge = (r: { expired: boolean; daysToExpiry: number | null }) => {
    if (r.daysToExpiry == null) return <span className="text-secondary">sans date</span>;
    if (r.expired) return <Badge bg="danger-subtle" text="danger" className="fw-normal">Expiré ({-r.daysToExpiry} j)</Badge>;
    if (r.daysToExpiry <= 7) return <Badge bg="warning-subtle" text="warning" className="fw-normal">Expire dans {r.daysToExpiry} j</Badge>;
    return <Badge bg="success-subtle" text="success" className="fw-normal">Valide ({r.daysToExpiry} j)</Badge>;
  };

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Devis à échéance</h4><p className="text-secondary mb-0">Devis émis en attente de réponse, par date de validité — relancez avant expiration</p></div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Devis</th><th scope="col">Client</th><th scope="col">Validité</th><th scope="col" className="text-center">Statut</th><th scope="col" className="text-end pe-3">Montant TTC</th></tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="ps-3 fw-medium">{r.number ?? '—'}</td>
                  <td>{r.company?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.validUntil)}</td>
                  <td className="text-center">{badge(r)}</td>
                  <td className="text-end pe-3 fw-semibold">{euro.format(r.totalTtc)}</td>
                </tr>
              ))}
              {q.isSuccess && rows.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucun devis en attente</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
