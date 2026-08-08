import { useState } from 'react';
import { Card, Table, Spinner, Badge, Alert } from 'react-bootstrap';
import { trpc } from '../trpc';

const qfmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

export default function StockLots() {
  const lots = trpc.stock.lots.useQuery();
  const allRows = lots.data ?? [];
  const expired = allRows.filter((r) => r.expired);
  const soon = allRows.filter((r) => r.expiringSoon);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const rows = allRows.filter((r) => !q || (r.lotNumber ?? '').toLowerCase().includes(q) || r.productName.toLowerCase().includes(q) || r.warehouseName.toLowerCase().includes(q));

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Lots &amp; péremption</h4><p className="text-secondary mb-0">Soldes par lot / n° de série et dates de péremption</p></div>

      {(expired.length > 0 || soon.length > 0) && (
        <Alert variant={expired.length > 0 ? 'danger' : 'warning'} className="d-flex align-items-start gap-2">
          <i className="bi bi-clock-history mt-1" />
          <div className="small">
            {expired.length > 0 && <div><strong>{expired.length} lot{expired.length > 1 ? 's' : ''} périmé{expired.length > 1 ? 's' : ''}</strong> — à retirer du stock.</div>}
            {soon.length > 0 && <div><strong>{soon.length} lot{soon.length > 1 ? 's' : ''}</strong> à péremption sous 30 jours.</div>}
          </div>
        </Alert>
      )}

      {allRows.length > 8 && (
        <div className="position-relative mb-3" style={{ maxWidth: 360 }}>
          <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
          <input className="form-control form-control-sm ps-4" aria-label="Rechercher un lot" placeholder="Rechercher (lot, article, entrepôt)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Lot / série</th><th scope="col">Article</th><th scope="col">Entrepôt</th><th scope="col" className="text-end">Quantité</th><th scope="col">Péremption</th><th scope="col" className="pe-3" /></tr>
            </thead>
            <tbody>
              {lots.isLoading && <tr><td colSpan={6} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={`${r.productId}-${r.warehouseId}-${r.lotNumber}`}>
                  <td className="ps-3 fw-medium">{r.lotNumber}</td>
                  <td>{r.productName}</td>
                  <td className="text-secondary">{r.warehouseName}</td>
                  <td className="text-end fw-semibold">{qfmt(r.quantity)} <span className="text-secondary fw-normal small">{r.unit}</span></td>
                  <td className={r.expired ? 'text-danger fw-medium' : r.expiringSoon ? 'text-warning fw-medium' : 'text-secondary'}>{dfmt(r.expiryDate)}</td>
                  <td className="pe-3">
                    {r.expired && <Badge bg="danger-subtle" text="danger" className="fw-normal">périmé</Badge>}
                    {!r.expired && r.expiringSoon && <Badge bg="warning-subtle" text="warning" className="fw-normal">bientôt</Badge>}
                  </td>
                </tr>
              ))}
              {lots.isSuccess && allRows.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Aucun lot enregistré (renseignez un n° de lot sur les mouvements)</td></tr>}
              {lots.isSuccess && allRows.length > 0 && rows.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Aucun lot pour cette recherche</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
