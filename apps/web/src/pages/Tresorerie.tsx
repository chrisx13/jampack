import { Card, Table, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

type Flow = { id: string; number: string | null; party: string; dueDate: unknown; amount: number; overdue: boolean };

function FlowTable({ rows, kind }: { rows: Flow[]; kind: 'in' | 'out' }) {
  return (
    <Table hover responsive size="sm" className="mb-0 align-middle">
      <thead className="text-secondary small">
        <tr><th className="ps-3">Pièce</th><th>{kind === 'in' ? 'Client' : 'Fournisseur'}</th><th>Échéance</th><th className="text-end pe-3">Montant</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="ps-3 fw-medium">{r.number ?? <span className="text-secondary fst-italic">—</span>}</td>
            <td>{r.party}</td>
            <td className="text-secondary">{dfmt(r.dueDate)} {r.overdue && <Badge bg="danger-subtle" text="danger" className="fw-normal ms-1">retard</Badge>}</td>
            <td className={`text-end pe-3 fw-medium ${kind === 'in' ? 'text-success' : 'text-danger'}`}>{kind === 'in' ? '' : '−'}{euro.format(r.amount)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-3">Aucun flux attendu</td></tr>}
      </tbody>
    </Table>
  );
}

export default function Tresorerie() {
  const q = trpc.analytics.tresorerie.useQuery();
  const d = q.data;

  if (q.isLoading || !d) return <div className="text-center py-5"><Spinner /></div>;

  const netPositive = d.net >= 0;
  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Trésorerie prévisionnelle</h4><p className="text-secondary mb-0">Encaissements clients attendus vs décaissements fournisseurs</p></div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <Card className="h-100"><Card.Body>
            <div className="text-secondary small mb-1"><i className="bi bi-arrow-down-circle text-success me-1" />À encaisser</div>
            <div className="fs-4 fw-semibold text-success">{euro.format(d.toReceive)}</div>
          </Card.Body></Card>
        </div>
        <div className="col-md-4">
          <Card className="h-100"><Card.Body>
            <div className="text-secondary small mb-1"><i className="bi bi-arrow-up-circle text-danger me-1" />À décaisser</div>
            <div className="fs-4 fw-semibold text-danger">{euro.format(d.toPay)}</div>
          </Card.Body></Card>
        </div>
        <div className="col-md-4">
          <Card className={`h-100 border-${netPositive ? 'success' : 'danger'}`}><Card.Body>
            <div className="text-secondary small mb-1"><i className="bi bi-wallet2 me-1" />Position nette</div>
            <div className={`fs-4 fw-semibold ${netPositive ? 'text-success' : 'text-danger'}`}>{euro.format(d.net)}</div>
          </Card.Body></Card>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <Card><Card.Header className="fw-semibold bg-transparent"><i className="bi bi-arrow-down-circle text-success me-2" />Encaissements attendus</Card.Header>
            <Card.Body className="p-0"><FlowTable rows={d.encaissements} kind="in" /></Card.Body>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card><Card.Header className="fw-semibold bg-transparent"><i className="bi bi-arrow-up-circle text-danger me-2" />Décaissements attendus</Card.Header>
            <Card.Body className="p-0"><FlowTable rows={d.decaissements} kind="out" /></Card.Body>
          </Card>
        </div>
      </div>
    </>
  );
}
