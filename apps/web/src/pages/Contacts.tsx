import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

type Row = {
  id: string; firstName: string; lastName: string; email: string | null; phone: string | null;
  companyId: string | null; societe?: { name: string } | null; company?: { name: string } | null;
};
const empty = { firstName: '', lastName: '', email: '', phone: '', companyId: '' };

export default function Contacts() {
  const utils = trpc.useUtils();
  const list = trpc.crm.contacts.list.useQuery();
  const companies = trpc.crm.companies.list.useQuery();
  const can = useCan();

  const [edit, setEdit] = useState<null | Partial<Row>>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);

  const invalidate = () => utils.crm.contacts.list.invalidate();
  const create = trpc.crm.contacts.create.useMutation({ onSuccess: () => { invalidate(); setEdit(null); } });
  const update = trpc.crm.contacts.update.useMutation({ onSuccess: () => { invalidate(); setEdit(null); } });
  const remove = trpc.crm.contacts.remove.useMutation({ onSuccess: () => { invalidate(); setDel(null); } });

  const open = (r?: Row) => {
    setForm(r ? { firstName: r.firstName, lastName: r.lastName, email: r.email ?? '', phone: r.phone ?? '', companyId: r.companyId ?? '' } : empty);
    setEdit(r ?? {});
  };
  const submit = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    const data = {
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      email: form.email || undefined, phone: form.phone || undefined, companyId: form.companyId || undefined,
    };
    if (edit && 'id' in edit && edit.id) update.mutate({ id: edit.id, ...data });
    else create.mutate(data);
  };
  const busy = create.isPending || update.isPending;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="mb-0 fw-semibold">Contacts</h4>
        {can('create', 'Contact') && <Button onClick={() => open()}><i className="bi bi-plus-lg me-1" />Nouveau contact</Button>}
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Nom</th><th>Client</th><th>Société</th><th>Email</th><th>Téléphone</th><th className="text-end pe-3">Actions</th></tr>
            </thead>
            <tbody>
              {list.data?.map((c) => (
                <tr key={c.id}>
                  <td className="ps-3 fw-medium">
                    <span className="rounded-circle bg-info-subtle text-info d-inline-grid me-2" style={{ width: 32, height: 32, placeItems: 'center', fontSize: 12 }}>
                      {(c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')}
                    </span>
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="text-secondary">{c.company?.name ?? '—'}</td>
                  <td className="text-secondary">{c.societe?.name ?? '—'}</td>
                  <td className="text-secondary">{c.email ?? '—'}</td>
                  <td className="text-secondary">{c.phone ?? '—'}</td>
                  <td className="text-end pe-3">
                    {can('update', 'Contact') && <Button variant="light" size="sm" className="me-1" onClick={() => open(c as Row)}><i className="bi bi-pencil" /></Button>}
                    {can('delete', 'Contact') && <Button variant="light" size="sm" className="text-danger" onClick={() => setDel(c as Row)}><i className="bi bi-trash" /></Button>}
                  </td>
                </tr>
              ))}
              {list.data?.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Aucun contact pour cette société</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={edit !== null} onHide={() => setEdit(null)} centered>
        <Modal.Header closeButton><Modal.Title>{edit && 'id' in edit ? 'Modifier le contact' : 'Nouveau contact'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <Form.Group className="col" controlId="ct-first"><Form.Label>Prénom</Form.Label><Form.Control autoFocus value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Form.Group>
            <Form.Group className="col" controlId="ct-last"><Form.Label>Nom</Form.Label><Form.Control value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Form.Group>
          </div>
          <Form.Group className="mt-2" controlId="ct-email"><Form.Label>Email</Form.Label><Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Form.Group>
          <Form.Group className="mt-2" controlId="ct-phone"><Form.Label>Téléphone</Form.Label><Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Form.Group>
          <Form.Group className="mt-2" controlId="ct-company">
            <Form.Label>Client</Form.Label>
            <Form.Select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">— Aucun —</option>
              {companies.data?.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
            </Form.Select>
          </Form.Group>
          {(create.error || update.error) && <div className="text-danger small mt-2">{(create.error || update.error)?.message}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setEdit(null)}>Annuler</Button>
          <Button onClick={submit} disabled={busy || !form.firstName.trim() || !form.lastName.trim()}>{busy ? <Spinner size="sm" /> : 'Enregistrer'}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={del !== null} onHide={() => setDel(null)} centered>
        <Modal.Header closeButton><Modal.Title>Supprimer</Modal.Title></Modal.Header>
        <Modal.Body>Supprimer le contact <strong>{del?.firstName} {del?.lastName}</strong> ?</Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setDel(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => del && remove.mutate({ id: del.id })} disabled={remove.isPending}>{remove.isPending ? <Spinner size="sm" /> : 'Supprimer'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
