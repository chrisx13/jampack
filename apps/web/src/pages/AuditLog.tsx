import { Card, Table, Spinner, Badge, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const dt = (d: unknown) => (d ? new Date(d as string).toLocaleString('fr-FR') : '—');

export default function AuditLog() {
  const list = trpc.audit.list.useQuery();
  const utils = trpc.useUtils();

  const exportCsv = async () => {
    const r = await utils.audit.exportCsv.fetch();
    const url = URL.createObjectURL(new Blob([r.content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div><h4 className="mb-1 fw-semibold">Journal d'audit</h4><p className="text-secondary mb-0">Traçabilité des actions (200 dernières affichées)</p></div>
        <Button variant="outline-secondary" size="sm" onClick={exportCsv} disabled={!list.data || list.data.length === 0}><i className="bi bi-download me-1" />Exporter CSV</Button>
      </div>
      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th className="ps-3">Date</th><th>Utilisateur</th><th>Action</th><th className="pe-3">Référence</th></tr></thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={4} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {list.data?.map((l) => (
              <tr key={l.id}>
                <td className="ps-3 text-secondary" style={{ whiteSpace: 'nowrap' }}>{dt(l.at)}</td>
                <td>{l.userEmail}</td>
                <td><Badge bg="secondary-subtle" text="secondary" className="fw-normal font-monospace">{l.action}</Badge></td>
                <td className="pe-3 text-secondary small">{l.ref ?? ''}</td>
              </tr>
            ))}
            {list.isSuccess && list.data.length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-4">Aucune entrée</td></tr>}
          </tbody>
        </Table>
      </Card.Body></Card>
    </>
  );
}
