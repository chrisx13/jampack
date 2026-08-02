import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Spinner, Badge, InputGroup } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const blank = { name: '', reference: '', kind: 'bien', unit: 'unité', priceHt: '', taxRateId: '', categoryId: '' };

type Row = { id: string } & typeof blank;

function CategoriesModal({ show, onHide }: { show: boolean; onHide: () => void }) {
  const utils = trpc.useUtils();
  const cats = trpc.catalog.categories.list.useQuery();
  const invalidate = () => { utils.catalog.categories.list.invalidate(); utils.catalog.products.list.invalidate(); };
  const create = trpc.catalog.categories.create.useMutation({ onSuccess: invalidate });
  const update = trpc.catalog.categories.update.useMutation({ onSuccess: invalidate });
  const archive = trpc.catalog.categories.archive.useMutation({ onSuccess: invalidate });
  const [newName, setNewName] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});

  const active = (cats.data ?? []).filter((c) => c.isActive);

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton><Modal.Title>Catégories d'articles</Modal.Title></Modal.Header>
      <Modal.Body>
        <InputGroup className="mb-3">
          <Form.Control placeholder="Nouvelle catégorie" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button disabled={!newName.trim() || create.isPending} onClick={() => { create.mutate({ name: newName.trim() }); setNewName(''); }}>
            <i className="bi bi-plus-lg" />
          </Button>
        </InputGroup>
        {active.length === 0 && <p className="text-secondary small mb-0">Aucune catégorie. Ajoutez-en une ci-dessus.</p>}
        {active.map((c) => (
          <div key={c.id} className="d-flex align-items-center gap-2 mb-2">
            <Form.Control
              size="sm"
              value={names[c.id] ?? c.name}
              onChange={(e) => setNames({ ...names, [c.id]: e.target.value })}
            />
            <Badge bg="secondary-subtle" text="secondary" className="fw-normal">{c._count.products}</Badge>
            <Button size="sm" variant="light" title="Renommer"
              disabled={update.isPending || (names[c.id] ?? c.name) === c.name}
              onClick={() => update.mutate({ id: c.id, name: (names[c.id] ?? c.name).trim() })}>
              <i className="bi bi-check2" />
            </Button>
            <Button size="sm" variant="light" className="text-danger" title="Archiver"
              disabled={archive.isPending}
              onClick={() => archive.mutate({ id: c.id })}>
              <i className="bi bi-archive" />
            </Button>
          </div>
        ))}
      </Modal.Body>
      <Modal.Footer><Button variant="light" onClick={onHide}>Fermer</Button></Modal.Footer>
    </Modal>
  );
}

export default function Catalogue() {
  const utils = trpc.useUtils();
  const list = trpc.catalog.products.list.useQuery();
  const taxRates = trpc.catalog.taxRates.list.useQuery();
  const categories = trpc.catalog.categories.list.useQuery();
  const can = useCan();

  const [edit, setEdit] = useState<null | { id?: string }>(null);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState(blank);
  const [showCats, setShowCats] = useState(false);
  const [filterCat, setFilterCat] = useState('');

  const activeCats = (categories.data ?? []).filter((c) => c.isActive);

  const done = () => { utils.catalog.products.list.invalidate(); setEdit(null); };
  const create = trpc.catalog.products.create.useMutation({ onSuccess: done });
  const update = trpc.catalog.products.update.useMutation({ onSuccess: done });
  const remove = trpc.catalog.products.remove.useMutation({ onSuccess: () => { utils.catalog.products.list.invalidate(); setDel(null); } });

  const open = (r?: Row) => {
    setForm(r ? { name: r.name, reference: r.reference ?? '', kind: r.kind, unit: r.unit, priceHt: String(r.priceHt ?? ''), taxRateId: r.taxRateId ?? '', categoryId: r.categoryId ?? '' } : blank);
    setEdit(r ? { id: r.id } : {});
  };
  const submit = () => {
    if (!form.name.trim()) return;
    const base = {
      name: form.name.trim(), reference: form.reference || undefined, kind: form.kind as 'bien' | 'service',
      unit: form.unit || undefined, priceHt: form.priceHt ? Number(form.priceHt) : undefined,
      taxRateId: form.taxRateId || undefined, categoryId: form.categoryId || undefined,
    };
    if (edit?.id) update.mutate({ id: edit.id, ...base });
    else create.mutate(base);
  };
  const busy = create.isPending || update.isPending;

  const rows = (list.data ?? []).filter((p) => !filterCat || (p as { categoryId?: string }).categoryId === filterCat);

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Catalogue</h4><p className="text-secondary mb-0">Articles & services</p></div>
        <div className="d-flex align-items-center gap-2">
          <Form.Select size="sm" style={{ width: 200 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {activeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Form.Select>
          {can('update', 'Product') && <Button variant="outline-secondary" onClick={() => setShowCats(true)}><i className="bi bi-tags me-1" />Catégories</Button>}
          {can('create', 'Product') && <Button onClick={() => open()}><i className="bi bi-plus-lg me-1" />Nouvel article</Button>}
        </div>
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Référence</th><th>Nom</th><th>Catégorie</th><th>Type</th><th>Unité</th><th className="text-end">Prix HT</th><th>TVA</th><th className="text-end pe-3">Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="ps-3 text-secondary">{p.reference ?? '—'}</td>
                  <td className="fw-medium">{p.name}</td>
                  <td>{p.category ? <Badge bg="secondary-subtle" text="secondary" className="fw-normal">{p.category.name}</Badge> : <span className="text-secondary">—</span>}</td>
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
              {rows.length === 0 && <tr><td colSpan={8} className="text-center text-secondary py-4">Aucun article {filterCat ? 'dans cette catégorie' : 'pour cette société'}</td></tr>}
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
            <div className="col-md-6"><Form.Label>Catégorie</Form.Label>
              <Form.Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">— Aucune —</option>
                {activeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3"><Form.Label>Type</Form.Label>
              <Form.Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="bien">Bien</option><option value="service">Service</option></Form.Select>
            </div>
            <div className="col-md-3"><Form.Label>Unité</Form.Label><Form.Control value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="col-md-4"><Form.Label>Prix HT (€)</Form.Label><Form.Control type="number" step="0.01" value={form.priceHt} onChange={(e) => setForm({ ...form, priceHt: e.target.value })} /></div>
            <div className="col-md-8"><Form.Label>TVA</Form.Label>
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

      <CategoriesModal show={showCats} onHide={() => setShowCats(false)} />
    </>
  );
}
