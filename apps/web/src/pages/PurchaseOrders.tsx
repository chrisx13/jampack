import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { PO_STATUS_LABELS } from '@jampack/domain';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'secondary-subtle', text: 'secondary' },
  sent: { bg: 'info-subtle', text: 'info' },
  partial: { bg: 'warning-subtle', text: 'warning' },
  received: { bg: 'success-subtle', text: 'success' },
  cancelled: { bg: 'danger-subtle', text: 'danger' },
};
function StatusBadge({ s }: { s: string }) {
  const c = STATUS_STYLE[s] ?? STATUS_STYLE.draft;
  return <Badge bg={c.bg} text={c.text} className="fw-normal">{PO_STATUS_LABELS[s] ?? s}</Badge>;
}

type Line = { productId?: string; label: string; quantity: number; unitPriceHt: number };

function Editor({ id: initialId, onClose }: { id: string | 'new'; onClose: () => void }) {
  const utils = trpc.useUtils();
  const can = useCan();
  const [id, setId] = useState<string | 'new'>(initialId);
  const suppliers = trpc.purchases.suppliers.useQuery();
  const warehouses = trpc.stock.warehouses.list.useQuery();
  const products = trpc.catalog.products.list.useQuery();
  const existing = trpc.purchases.orders.get.useQuery({ id: id as string }, { enabled: id !== 'new' });

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState('draft');
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    const po = existing.data;
    if (!po) return;
    setSupplierId(po.supplierId);
    setWarehouseId(po.warehouseId ?? '');
    setExpectedDate(po.expectedDate ? new Date(po.expectedDate).toISOString().slice(0, 10) : '');
    setNotes(po.notes ?? '');
    setStatus(po.status);
    setNumber(po.number ?? null);
    setLines(po.lines.map((l) => ({ productId: l.productId ?? undefined, label: l.label, quantity: num(l.quantity), unitPriceHt: num(l.unitPriceHt) })));
  }, [existing.data]);

  const create = trpc.purchases.orders.create.useMutation();
  const update = trpc.purchases.orders.update.useMutation();
  const validate = trpc.purchases.orders.validate.useMutation();
  const receive = trpc.purchases.orders.receive.useMutation();
  const receivePartial = trpc.purchases.orders.receivePartial.useMutation();
  const duplicate = trpc.purchases.orders.duplicate.useMutation();
  const onDuplicate = async () => {
    const copy = await duplicate.mutateAsync({ id: id as string });
    utils.purchases.orders.list.invalidate();
    setId(copy.id);
  };
  const invoiceFrom = trpc.supplierInvoices.fromOrder.useMutation();
  const onInvoice = async () => {
    await invoiceFrom.mutateAsync({ id: id as string });
    utils.supplierInvoices.list.invalidate();
    alert('Facture fournisseur (brouillon) créée depuis cette commande — voir l’onglet Factures fournisseurs. Complétez la référence et la TVA.');
  };
  const busy = create.isPending || update.isPending || validate.isPending || receive.isPending || receivePartial.isPending;
  const readOnly = status !== 'draft';
  const canReceive = status === 'sent' || status === 'partial';

  // Réception par ligne : reste dû (commandé − déjà reçu) et quantité reçue lors de cette livraison.
  const poLines = existing.data?.lines ?? [];
  const [receiptQty, setReceiptQty] = useState<Record<string, string>>({});
  const outstanding = (l: { quantity: unknown; quantityReceived: unknown }) => Math.round((num(l.quantity) - num(l.quantityReceived)) * 1000) / 1000;
  const onReceivePartial = async () => {
    const linesIn = poLines
      .map((l) => ({ lineId: l.id, quantity: Number(receiptQty[l.id] ?? '') }))
      .filter((x) => Number.isFinite(x.quantity) && x.quantity > 0);
    if (linesIn.length === 0) return;
    await receivePartial.mutateAsync({ id: id as string, lines: linesIn });
    setReceiptQty({});
    utils.purchases.orders.list.invalidate(); utils.purchases.orders.get.invalidate({ id: id as string });
    utils.stock.levels.invalidate(); utils.stock.movements.list.invalidate();
  };

  const totalHt = useMemo(() => Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPriceHt, 0) * 100) / 100, [lines]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { label: '', quantity: 1, unitPriceHt: 0 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, k) => k !== i));
  const onPickProduct = (i: number, productId: string) => {
    const p = products.data?.find((x) => x.id === productId);
    if (!p) { setLine(i, { productId: undefined }); return; }
    setLine(i, { productId, label: p.name, unitPriceHt: num(p.priceHt) });
  };

  const payload = () => ({
    supplierId,
    warehouseId: warehouseId || undefined,
    expectedDate: expectedDate || undefined,
    notes: notes || undefined,
    lines: lines.map((l, i) => ({ productId: l.productId, label: l.label || 'Ligne', quantity: l.quantity, unitPriceHt: l.unitPriceHt, position: i })),
  });
  const persist = async () => {
    if (id === 'new') { const po = await create.mutateAsync(payload()); setId(po.id); return po.id; }
    await update.mutateAsync({ id, ...payload() });
    return id;
  };
  const refresh = () => { utils.purchases.orders.list.invalidate(); if (id !== 'new') utils.purchases.orders.get.invalidate({ id }); };
  const onSave = async () => { await persist(); refresh(); };
  const onValidate = async () => { const theId = await persist(); await validate.mutateAsync({ id: theId }); utils.purchases.orders.list.invalidate(); onClose(); };
  const onReceive = async () => {
    await receive.mutateAsync({ id });
    utils.purchases.orders.list.invalidate(); utils.purchases.orders.get.invalidate({ id });
    utils.stock.levels.invalidate(); utils.stock.movements.list.invalidate();
    alert('Réception enregistrée — le stock a été mis à jour (voir Stock ▸ Niveaux).');
  };

  const err = create.error || update.error || validate.error || receive.error || receivePartial.error;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" onClick={onClose}><i className="bi bi-arrow-left" /></Button>
          <div>
            <h4 className="mb-1 fw-semibold">{number ? `Commande ${number}` : id === 'new' ? 'Nouvelle commande' : 'Commande (brouillon)'}</h4>
            <StatusBadge s={status} />
          </div>
        </div>
        <div className="d-flex gap-2">
          {canReceive && (
            <Button variant="success" onClick={onReceive} disabled={busy}><i className="bi bi-box-arrow-in-down me-1" />Tout réceptionner</Button>
          )}
          {id !== 'new' && can('create', 'PurchaseOrder') && (
            <Button variant="light" title="Dupliquer en brouillon" disabled={duplicate.isPending} onClick={onDuplicate}><i className="bi bi-files me-1" />Dupliquer</Button>
          )}
          {id !== 'new' && status !== 'draft' && status !== 'cancelled' && can('create', 'SupplierInvoice') && (
            <Button variant="outline-primary" title="Créer une facture fournisseur depuis cette commande" disabled={invoiceFrom.isPending} onClick={onInvoice}><i className="bi bi-receipt-cutoff me-1" />Facturer</Button>
          )}
          {!readOnly && (
            <>
              <Button variant="light" onClick={onSave} disabled={busy || !supplierId}>{busy ? <Spinner size="sm" /> : <><i className="bi bi-save me-1" />Enregistrer</>}</Button>
              <Button onClick={onValidate} disabled={busy || !supplierId || lines.length === 0}><i className="bi bi-check2-circle me-1" />Valider & envoyer</Button>
            </>
          )}
        </div>
      </div>

      <Card className="mb-3">
        <Card.Body>
          <div className="row g-3">
            <div className="col-md-5">
              <Form.Label>Fournisseur</Form.Label>
              <Form.Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={readOnly}>
                <option value="">— Sélectionner —</option>
                {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Form.Select>
              {suppliers.data?.length === 0 && <div className="text-secondary small mt-1">Aucun fournisseur : marquez un client comme fournisseur dans le CRM.</div>}
            </div>
            <div className="col-md-4">
              <Form.Label>Entrepôt de réception</Form.Label>
              <Form.Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={readOnly}>
                <option value="">— Aucun —</option>
                {(warehouses.data ?? []).filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Livraison prévue</Form.Label>
              <Form.Control type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} disabled={readOnly} />
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body className="p-0">
          <Table className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3" style={{ width: 200 }}>Article</th><th scope="col">Désignation</th><th scope="col" className="text-end" style={{ width: 100 }}>Qté</th><th scope="col" className="text-end" style={{ width: 130 }}>PU HT</th><th scope="col" className="text-end" style={{ width: 130 }}>Total HT</th><th scope="col" style={{ width: 50 }} /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="ps-3">
                    <Form.Select size="sm" value={l.productId ?? ''} onChange={(e) => onPickProduct(i, e.target.value)} disabled={readOnly}>
                      <option value="">— Libre —</option>
                      {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Form.Select>
                  </td>
                  <td><Form.Control size="sm" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} disabled={readOnly} /></td>
                  <td><Form.Control size="sm" type="number" step="0.001" className="text-end" value={l.quantity} onChange={(e) => setLine(i, { quantity: num(e.target.value) })} disabled={readOnly} /></td>
                  <td><Form.Control size="sm" type="number" step="0.01" className="text-end" value={l.unitPriceHt} onChange={(e) => setLine(i, { unitPriceHt: num(e.target.value) })} disabled={readOnly} /></td>
                  <td className="text-end">{euro.format(l.quantity * l.unitPriceHt)}</td>
                  <td className="text-end pe-2">{!readOnly && <Button variant="light" size="sm" className="text-danger" onClick={() => removeLine(i)}><i className="bi bi-trash" /></Button>}</td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Aucune ligne</td></tr>}
            </tbody>
          </Table>
          {!readOnly && <div className="p-2 border-top"><Button variant="light" size="sm" onClick={addLine}><i className="bi bi-plus-lg me-1" />Ajouter une ligne</Button></div>}
        </Card.Body>
      </Card>

      {canReceive && poLines.some((l) => outstanding(l) > 0) && (
        <Card className="mb-3 border-success">
          <Card.Header className="bg-transparent fw-semibold"><i className="bi bi-box-arrow-in-down text-success me-2" />Réception échelonnée — saisir les quantités reçues</Card.Header>
          <Card.Body className="p-0">
            <Table className="mb-0 align-middle">
              <thead className="text-secondary small">
                <tr><th scope="col" className="ps-3">Article</th><th scope="col" className="text-end">Commandé</th><th scope="col" className="text-end">Déjà reçu</th><th scope="col" className="text-end">Reste dû</th><th scope="col" className="text-end pe-3" style={{ width: 140 }}>Reçu maintenant</th></tr>
              </thead>
              <tbody>
                {poLines.map((l) => {
                  const rem = outstanding(l);
                  return (
                    <tr key={l.id}>
                      <td className="ps-3">{l.label}</td>
                      <td className="text-end">{num(l.quantity)}</td>
                      <td className="text-end text-secondary">{num(l.quantityReceived)}</td>
                      <td className="text-end fw-medium">{rem}</td>
                      <td className="text-end pe-3">
                        <Form.Control size="sm" type="number" step="0.001" min={0} max={rem} className="text-end" placeholder="0" disabled={rem <= 0}
                          value={receiptQty[l.id] ?? ''} onChange={(e) => setReceiptQty((q) => ({ ...q, [l.id]: e.target.value }))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="p-2 border-top text-end">
              <Button variant="success" size="sm" onClick={onReceivePartial} disabled={busy}><i className="bi bi-check2 me-1" />Valider la réception</Button>
            </div>
          </Card.Body>
        </Card>
      )}

      <div className="row">
        <div className="col-md-7">
          <Form.Label>Notes</Form.Label>
          <Form.Control as="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} />
        </div>
        <div className="col-md-5">
          <Card><Card.Body>
            <div className="d-flex justify-content-between"><span className="fw-semibold">Total HT</span><span className="fw-semibold fs-5">{euro.format(totalHt)}</span></div>
          </Card.Body></Card>
        </div>
      </div>
      {err && <div className="text-danger small mt-2">{err.message}</div>}
    </>
  );
}

export default function PurchaseOrders() {
  const list = trpc.purchases.orders.list.useQuery();
  const can = useCan();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [search, setSearch] = useState('');

  if (editing) return <Editor id={editing} onClose={() => setEditing(null)} />;

  const all = (list.data ?? []) as { id: string; number?: string | null; status: string; orderDate?: unknown; expectedDate?: unknown; totalHt: number; supplier?: { name?: string } }[];
  const q = search.trim().toLowerCase();
  const rows = q ? all.filter((r) => (r.number ?? '').toLowerCase().includes(q) || (r.supplier?.name ?? '').toLowerCase().includes(q)) : all;
  const showSearch = all.length > 5;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Commandes fournisseurs</h4><p className="text-secondary mb-0">Achats & réceptions</p></div>
        {can('create', 'PurchaseOrder') && <Button onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />Nouvelle commande</Button>}
      </div>

      {showSearch && (
        <div className="position-relative mb-3" style={{ maxWidth: 360 }}>
          <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
          <input className="form-control form-control-sm ps-4" aria-label="Rechercher une commande" placeholder="Rechercher (numéro ou fournisseur)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Numéro</th><th scope="col">Fournisseur</th><th scope="col">Commande</th><th scope="col">Livraison prévue</th><th scope="col" className="text-end">Total HT</th><th scope="col">Statut</th><th scope="col" className="pe-3"><span className="visually-hidden">Ouvrir</span></th></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r.id)}>
                  <td className="ps-3 fw-medium">
                    <button type="button" className="btn btn-link p-0 text-decoration-none text-body fw-medium" onClick={(e) => { e.stopPropagation(); setEditing(r.id); }}>{r.number ?? <span className="text-secondary fst-italic">brouillon</span>}<span className="visually-hidden"> — ouvrir</span></button>
                  </td>
                  <td>{r.supplier?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.orderDate)}</td>
                  <td className="text-secondary">{dfmt(r.expectedDate)}</td>
                  <td className="text-end fw-medium">{euro.format(r.totalHt)}</td>
                  <td><StatusBadge s={r.status} /></td>
                  <td className="text-end pe-3"><i className="bi bi-chevron-right text-secondary" aria-hidden="true" /></td>
                </tr>
              ))}
              {list.isSuccess && all.length === 0 && (
                <tr><td colSpan={7} className="text-center text-secondary py-5">
                  <div className="mb-2"><i className="bi bi-cart fs-3 opacity-50" aria-hidden="true" /></div>
                  <div className="mb-3">Aucune commande fournisseur pour l'instant.</div>
                  {can('create', 'PurchaseOrder') && <Button size="sm" onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" aria-hidden="true" />Nouvelle commande</Button>}
                </td></tr>
              )}
              {all.length > 0 && rows.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucun résultat pour ce filtre</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
