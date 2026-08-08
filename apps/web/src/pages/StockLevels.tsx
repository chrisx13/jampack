import { useState } from 'react';
import { Card, Table, Spinner, Alert, Button, Modal, Form, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const qfmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });

type LevelRow = { productId: string; productName: string; reference: string | null; unit: string; warehouseId: string; warehouseName: string; quantity: number };

export default function StockLevels() {
  const utils = trpc.useUtils();
  const can = useCan();
  const levels = trpc.stock.levels.useQuery();
  const lowStock = trpc.stock.lowStock.useQuery();
  const inventory = trpc.stock.inventory.useMutation();
  const allRows = levels.data ?? [];
  const low = lowStock.data ?? [];

  const [count, setCount] = useState<null | { row: LevelRow; value: string }>(null);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const rows = allRows.filter((r) => !q || r.productName.toLowerCase().includes(q) || (r.reference ?? '').toLowerCase().includes(q) || r.warehouseName.toLowerCase().includes(q));

  const submitInventory = async () => {
    if (!count) return;
    await inventory.mutateAsync({ warehouseId: count.row.warehouseId, productId: count.row.productId, countedQuantity: Number(count.value) });
    setCount(null);
    utils.stock.levels.invalidate(); utils.stock.lowStock.invalidate(); utils.stock.valuation.invalidate();
  };

  const exportCsv = async () => {
    const { filename, content } = await utils.stock.exportLevels.fetch();
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div><h4 className="mb-1 fw-semibold">Niveaux de stock</h4><p className="text-secondary mb-0">Quantités nettes par article et entrepôt</p></div>
        <Button variant="outline-secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}><i className="bi bi-download me-1" />Exporter CSV</Button>
      </div>

      {low.length > 0 && (
        <Alert variant="warning" className="d-flex align-items-start gap-2">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div>
            <div className="fw-semibold mb-1">{low.length} article{low.length > 1 ? 's' : ''} sous le seuil de réapprovisionnement</div>
            <div className="small">
              {low.map((p) => (
                <span key={p.productId} className="me-3">{p.productName} : <strong>{qfmt(p.quantity)}</strong> / seuil {qfmt(p.reorderPoint)} {p.unit} <Badge bg="danger-subtle" text="danger" className="fw-normal">manque {qfmt(p.manque)}</Badge></span>
              ))}
            </div>
          </div>
        </Alert>
      )}

      {allRows.length > 8 && (
        <div className="position-relative mb-3" style={{ maxWidth: 360 }}>
          <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
          <input className="form-control form-control-sm ps-4" aria-label="Rechercher un article" placeholder="Rechercher (article, référence, entrepôt)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Article</th><th scope="col">Référence</th><th scope="col">Entrepôt</th><th scope="col" className="text-end">Quantité</th><th scope="col" className="pe-3" /></tr>
            </thead>
            <tbody>
              {levels.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={`${r.productId}-${r.warehouseId}`}>
                  <td className="ps-3 fw-medium">{r.productName}</td>
                  <td className="text-secondary">{r.reference ?? '—'}</td>
                  <td>{r.warehouseName}</td>
                  <td className={`text-end fw-semibold ${r.quantity < 0 ? 'text-danger' : ''}`}>{qfmt(r.quantity)} <span className="text-secondary fw-normal small">{r.unit}</span></td>
                  <td className="text-end pe-3">
                    {can('create', 'StockMovement') && (
                      <Button variant="light" size="sm" title="Inventaire (aligner sur la quantité comptée)" onClick={() => setCount({ row: r, value: String(r.quantity) })}>
                        <i className="bi bi-clipboard-check" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {levels.isSuccess && allRows.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucun mouvement de stock enregistré</td></tr>}
              {levels.isSuccess && allRows.length > 0 && rows.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucun article pour cette recherche</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={count !== null} onHide={() => setCount(null)} centered>
        <Modal.Header closeButton><Modal.Title>Inventaire</Modal.Title></Modal.Header>
        <Modal.Body>
          {count && (
            <>
              <p className="mb-2"><strong>{count.row.productName}</strong> — {count.row.warehouseName}</p>
              <p className="text-secondary small">Quantité en stock actuelle : {qfmt(count.row.quantity)} {count.row.unit}. Saisissez la quantité <strong>réellement comptée</strong> ; un mouvement d'ajustement sera généré.</p>
              <Form.Label>Quantité comptée</Form.Label>
              <Form.Control type="number" step="0.001" autoFocus value={count.value} onChange={(e) => setCount({ ...count, value: e.target.value })} />
              {inventory.error && <div className="text-danger small mt-2">{inventory.error.message}</div>}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setCount(null)}>Annuler</Button>
          <Button onClick={submitInventory} disabled={inventory.isPending || count?.value === ''}>{inventory.isPending ? <Spinner size="sm" /> : 'Valider l’inventaire'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
