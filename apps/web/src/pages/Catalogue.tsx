import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const blank = { name: '', reference: '', kind: 'bien', unit: 'unité', priceHt: '', taxRateId: '' };

type Row = { id: string } & typeof blank;

export default function Catalogue() {
  const utils = trpc.useUtils();
  const list = trpc.catalog.products.list.useQuery();
  const taxRates = trpc.catalog.taxRates.list.useQuery();
  const can = useCan();

  const [edit, setEdit] = useState<null | { id?: string }>(null);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState(blank);

  const done = () => { utils.catalog.products.list.invalidate(); setEdit(null); };
  const create = trpc.catalog.products.create.useMutation({ onSuccess: done });
  const update = trpc.catalog.products.update.useMutation({ onSuccess: done });
  const remove = trpc.catalog.products.remove.useMutation({ onSuccess: () => { utils.catalog.products.list.invalidate(); setDel(null); } });

  const open = (r?: Row) => {
    setForm(r ? { name: r.name, reference: r.reference ?? '', kind: r.kind, unit: r.unit, priceHt: String(r.priceHt ?? ''), taxRateId: r.taxRateId ?? '' } : blank);
    setEdit(r ? { id: r.id } : {});
  };
  const submit = () => {
    if (!form.name.trim()) return;
    const base = {
      name: form.name.trim(), reference: form.reference || undefined, kind: form.kind as 'bien' | 'service',
      unit: form.unit || undefined, priceHt: form.priceHt ? Number(form.priceHt) : undefined, taxRateId: form.taxRateId || undefined,
    };
    if (edit?.id) update.mutate({ id: edit.id, ...base });
    else create.mutate(base);
  };
  const busy = create.isPending || update.isPending;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Catalogue</h4><p className="text-secondary mb-0">Articles & services</p></div>
        {can('create', 'Product') && <Button onClick={() => open()}><i className="bi bi-plus-lg me-1" />Nouvel article</Button>}
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Référence</th><th>Nom</th><th>Type</th><th>Unité</th><th className="text-end">Prix HT</th><th>TVA</th><th className="text-end pe-3">Actions</th></tr>
            </thead>
            <tbody>
              {list.data?.map((p) => (
                <tr key={p.id}>
                  <td className="ps-3 text-secondary">{p.reference ?? '—'}</td>
                  <td className="fw-medium">{p.name}</td>
                  <td><Badge bg={p.kind === 'service' ? 'info-subtle' : 'primary-subtle'} text={p.kind === 'service' ? 'info' : 'primary'} className="fw-normal">{p.kind}</Badge></td>
                  <td className="text-secondary">{p.unit}</td>
                  <td className="text-end">{euro.format(num(p.priceHt))}</td>
                  <td className="text-secondary">{p.taxRate?.name ?? '—'}</td>
                  <td className="text-end pe-3">
                    {can('update', 'Product') && <Button variant="light" size="sm" className="me-1" onClick={() => open(p as unknown as Row)}><i className="bi bi-pencil" /></Button>}
                    {can('delete', 'Product') && <Button variant="light" size="sm" className="text-danger" onClick={() => setDel({ id: p.id, name: p.name })}><i className="bi bi-trash" /></Button>}
                  </td>
                </tr>
              ))}
              {list.data?.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucun article pour cette société</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={edit !== null} onHide={() => setEdit(null)} centered>
        <Modal.Header closeButton><Modal.Title>{edit?.id ? "Modifier l'article" : 'Nouvel article'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-md-8"><Form.Label>Nom</Form.Label><Form.Control autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-md-4"><Form.Label>Référence</Form.Label><Form.Control value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            <div className="col-md-4"><Form.Label>Type</Form.Label>
              <Form.Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="bien">Bien</option><option value="service">Service</option></Form.Select>
            </div>
            <div className="col-md-4"><Form.Label>Unité</Form.Label><Form.Control value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="col-md-4"><Form.Label>Prix HT (€)</Form.Label><Form.Control type="number" step="0.01" value={form.priceHt} onChange={(e) => setForm({ ...form, priceHt: e.target.value })} /></div>
            <div className="col-12"><Form.Label>TVA</Form.Label>
              <Form.Select value={form.taxRateId} onChange={(e) => setForm({ ...form, taxRateId: e.target.value })}>
                <option value="">— Aucune —</option>
                {taxRates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Form.Select>
            </div>
          </div>
          {(create.error || update.error) && <div className="text-danger small mt-2">{(create.error || update.error)?.message}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setEdit(null)}>Annuler</Button>
          <Button onClick={submit} disabled={busy || !form.name.trim()}>{busy ? <Spinner size="sm" /> : 'Enregistrer'}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={del !== null} onHide={() => setDel(null)} centered>
        <Modal.Header closeButton><Modal.Title>Supprimer</Modal.Title></Modal.Header>
        <Modal.Body>Supprimer l'article <strong>{del?.name}</strong> ?</Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setDel(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => del && remove.mutate({ id: del.id })} disabled={remove.isPending}>{remove.isPending ? <Spinner size="sm" /> : 'Supprimer'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
