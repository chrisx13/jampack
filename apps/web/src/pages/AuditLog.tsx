import { useState } from 'react';
import { Card, Table, Spinner, Badge, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const dt = (d: unknown) => (d ? new Date(d as string).toLocaleString('fr-FR') : '—');

export default function AuditLog() {
  const list = trpc.audit.list.useQuery();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const allRows = list.data ?? [];
  const filtered = allRows.filter((l) => !q || (l.userEmail ?? '').toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || (l.ref ?? '').toLowerCase().includes(q));

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
      {allRows.length > 8 && (
        <div className="position-relative mb-3" style={{ maxWidth: 360 }}>
          <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
          <input className="form-control form-control-sm ps-4" aria-label="Rechercher dans le journal d'audit" placeholder="Rechercher (utilisateur, action, référence)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}
      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th scope="col" className="ps-3">Date</th><th scope="col">Utilisateur</th><th scope="col">Action</th><th scope="col" className="pe-3">Référence</th></tr></thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={4} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {filtered.map((l) => (
              <tr key={l.id}>
                <td className="ps-3 text-secondary" style={{ whiteSpace: 'nowrap' }}>{dt(l.at)}</td>
                <td>{l.userEmail}</td>
                <td><Badge bg="secondary-subtle" text="secondary" className="fw-normal font-monospace">{l.action}</Badge></td>
                <td className="pe-3 text-secondary small">{l.ref ?? ''}</td>
              </tr>
            ))}
            {list.isSuccess && allRows.length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-4">Aucune entrée</td></tr>}
            {list.isSuccess && allRows.length > 0 && filtered.length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-4">Aucune entrée pour cette recherche</td></tr>}
          </tbody>
        </Table>
      </Card.Body></Card>
    </>
  );
}
