import { useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { STOCK_KINDS, STOCK_KIND_LABELS, type StockKind } from '@jampack/domain';

const qfmt = (v: unknown) => Number(v as never).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };

const KIND_STYLE: Record<string, { bg: string; text: string }> = {
  entree: { bg: 'success-subtle', text: 'success' },
  sortie: { bg: 'danger-subtle', text: 'danger' },
  ajustement: { bg: 'warning-subtle', text: 'warning' },
};

export default function StockMovements() {
  const utils = trpc.useUtils();
  const can = useCan();
  const movements = trpc.stock.movements.list.useQuery(undefined);
  const warehouses = trpc.stock.warehouses.list.useQuery();
  const products = trpc.catalog.products.list.useQuery();
  const create = trpc.stock.movements.create.useMutation();
  const remove = trpc.stock.movements.remove.useMutation();

  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [kind, setKind] = useState<StockKind>('entree');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const transfer = trpc.stock.movements.transfer.useMutation();
  const [tProductId, setTProductId] = useState('');
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');
  const [tQty, setTQty] = useState(1);

  const refresh = () => { utils.stock.movements.list.invalidate(); utils.stock.levels.invalidate(); utils.stock.lots.invalidate(); };
  const add = async () => {
    if (!warehouseId || !productId || !(quantity !== 0)) return;
    await create.mutateAsync({ warehouseId, productId, kind, quantity, note: note || undefined, lotNumber: lotNumber || undefined, expiryDate: expiryDate || undefined });
    setNote(''); setQuantity(1); setLotNumber(''); setExpiryDate(''); refresh();
  };
  const doTransfer = async () => {
    if (!tProductId || !tFrom || !tTo || tFrom === tTo || tQty <= 0) return;
    await transfer.mutateAsync({ productId: tProductId, fromWarehouseId: tFrom, toWarehouseId: tTo, quantity: tQty });
    setTQty(1); refresh();
  };
  const del = async (id: string) => { await remove.mutateAsync({ id }); refresh(); };

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Mouvements de stock</h4><p className="text-secondary mb-0">Entrées, sorties et ajustements</p></div>

      {can('create', 'StockMovement') && (
        <Card className="mb-3">
          <Card.Body>
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <Form.Label className="small mb-1">Entrepôt</Form.Label>
                <Form.Select size="sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {(warehouses.data ?? []).filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Article</Form.Label>
                <Form.Select size="sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Form.Label className="small mb-1">Type</Form.Label>
                <Form.Select size="sm" value={kind} onChange={(e) => setKind(e.target.value as StockKind)}>
                  {STOCK_KINDS.map((k) => <option key={k} value={k}>{STOCK_KIND_LABELS[k]}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Form.Label className="small mb-1">Quantité{kind === 'ajustement' ? ' (± signée)' : ''}</Form.Label>
                <Form.Control size="sm" type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(num(e.target.value))} />
              </div>
              <div className="col-md-2">
                <Button size="sm" className="w-100" onClick={add} disabled={create.isPending || !warehouseId || !productId}><i className="bi bi-plus-lg me-1" />Enregistrer</Button>
              </div>
            </div>
            <div className="row g-2 mt-1">
              <div className="col-md-3">
                <Form.Control size="sm" placeholder="N° de lot / série (optionnel)" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
              </div>
              <div className="col-md-3">
                <Form.Control size="sm" type="date" title="Date de péremption (DLC/DDM)" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
              <div className="col-md-6">
                <Form.Control size="sm" placeholder="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            {create.error && <div className="text-danger small mt-2">{create.error.message}</div>}
          </Card.Body>
        </Card>
      )}

      {can('create', 'StockMovement') && (
        <Card className="mb-3">
          <Card.Body>
            <div className="d-flex align-items-center mb-2"><i className="bi bi-arrow-left-right me-2 text-secondary" /><span className="fw-semibold">Transfert inter-entrepôts</span></div>
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <Form.Label className="small mb-1">Article</Form.Label>
                <Form.Select size="sm" value={tProductId} onChange={(e) => setTProductId(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">De (source)</Form.Label>
                <Form.Select size="sm" value={tFrom} onChange={(e) => setTFrom(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {(warehouses.data ?? []).filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Vers (destination)</Form.Label>
                <Form.Select size="sm" value={tTo} onChange={(e) => setTTo(e.target.value)} isInvalid={!!tTo && tTo === tFrom}>
                  <option value="">— Sélectionner —</option>
                  {(warehouses.data ?? []).filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-1">
                <Form.Label className="small mb-1">Qté</Form.Label>
                <Form.Control size="sm" type="number" step="0.001" min={0} value={tQty} onChange={(e) => setTQty(num(e.target.value))} />
              </div>
              <div className="col-md-2">
                <Button size="sm" variant="outline-primary" className="w-100" onClick={doTransfer} disabled={transfer.isPending || !tProductId || !tFrom || !tTo || tFrom === tTo || tQty <= 0}><i className="bi bi-arrow-left-right me-1" />Transférer</Button>
              </div>
            </div>
            {transfer.error && <div className="text-danger small mt-2">{transfer.error.message}</div>}
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Date</th><th>Article</th><th>Entrepôt</th><th>Type</th><th className="text-end">Quantité</th><th className="pe-3" /></tr>
            </thead>
            <tbody>
              {movements.isLoading && <tr><td colSpan={6} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {movements.data?.map((m) => {
                const s = KIND_STYLE[m.kind] ?? KIND_STYLE.ajustement;
                return (
                  <tr key={m.id}>
                    <td className="ps-3 text-secondary">{dfmt(m.date)}</td>
                    <td className="fw-medium">{m.product?.name ?? '—'}</td>
                    <td>{m.warehouse?.name ?? '—'}</td>
                    <td><Badge bg={s.bg} text={s.text} className="fw-normal">{STOCK_KIND_LABELS[m.kind as StockKind] ?? m.kind}</Badge></td>
                    <td className={`text-end fw-medium ${num(m.quantity) < 0 ? 'text-danger' : ''}`}>{qfmt(m.quantity)} <span className="text-secondary fw-normal small">{m.product?.unit}</span></td>
                    <td className="text-end pe-3">{can('delete', 'StockMovement') && <Button variant="light" size="sm" className="text-danger" onClick={() => del(m.id)}><i className="bi bi-trash" /></Button>}</td>
                  </tr>
                );
              })}
              {movements.data?.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Aucun mouvement</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
