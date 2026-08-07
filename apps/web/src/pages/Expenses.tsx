import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { EXPENSE_CATEGORIES } from '@jampack/domain';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Brouillon', bg: 'secondary-subtle', text: 'secondary' },
  validated: { label: 'Validée', bg: 'primary-subtle', text: 'primary' },
  reimbursed: { label: 'Remboursée', bg: 'success-subtle', text: 'success' },
};

export default function Expenses() {
  const utils = trpc.useUtils();
  const can = useCan();
  const editable = can('create', 'Expense');        // saisie/gestion (salarié)
  const canProcess = can('create', 'Accounting');    // validation / comptabilisation / remboursement
  const canExport = can('read', 'Accounting');
  const list = trpc.expenses.list.useQuery();
  const inv = () => utils.expenses.list.invalidate();
  const create = trpc.expenses.create.useMutation({ onSuccess: () => { inv(); setOpen(false); } });
  const validate = trpc.expenses.validate.useMutation({ onSuccess: inv });
  const post = trpc.expenses.post.useMutation({ onSuccess: () => { inv(); utils.accounting.balance.invalidate(); } });
  const reimburse = trpc.expenses.markReimbursed.useMutation({ onSuccess: inv });
  const remove = trpc.expenses.remove.useMutation({ onSuccess: inv });

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), category: 'deplacement', description: '', amountHt: '', taxRatePct: '20' });
  const rows = list.data ?? [];

  const submit = () => {
    if (!f.description.trim() || !(num(f.amountHt) >= 0)) return;
    create.mutate({ date: f.date, category: f.category as 'repas', description: f.description.trim(), amountHt: num(f.amountHt), taxRatePct: num(f.taxRatePct) });
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Notes de frais</h4><p className="text-secondary mb-0">Dépenses salariés — validation puis comptabilisation (6xx / TVA / 421)</p></div>
        <div className="d-flex gap-2">
          {rows.length > 0 && canExport && <Button variant="light" title="Exporter en CSV" onClick={async () => { const r = await utils.expenses.exportCsv.fetch(); const url = URL.createObjectURL(new Blob([r.content], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url); }}><i className="bi bi-filetype-csv me-1" />CSV</Button>}
          {editable && <Button onClick={() => { setF({ date: new Date().toISOString().slice(0, 10), category: 'deplacement', description: '', amountHt: '', taxRatePct: '20' }); setOpen(true); }}><i className="bi bi-plus-lg me-1" />Nouvelle note</Button>}
        </div>
      </div>

      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th scope="col" className="ps-3">Date</th><th scope="col">Catégorie</th><th scope="col">Description</th><th scope="col">Salarié</th><th scope="col" className="text-end">HT</th><th scope="col" className="text-end">TTC</th><th scope="col">Statut</th><th scope="col" className="text-end pe-3">Actions</th></tr></thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={8} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="ps-3 text-secondary">{dfmt(e.date)}</td>
                <td>{e.categoryLabel}</td>
                <td className="fw-medium">{e.description}</td>
                <td className="text-secondary">{e.incurredBy?.name ?? e.incurredBy?.email ?? '—'}</td>
                <td className="text-end">{euro.format(e.ht)}</td>
                <td className="text-end fw-medium">{euro.format(e.ttc)}</td>
                <td>{(() => { const s = STATUS[e.status] ?? STATUS.draft; return <Badge bg={s.bg} text={s.text} className="fw-normal">{s.label}</Badge>; })()}{e.posted && <Badge bg="info-subtle" text="info" className="fw-normal ms-1">comptabilisée</Badge>}</td>
                <td className="text-end pe-3">
                  {e.hasReceipt && <Button variant="light" size="sm" className="me-1" title="Voir le justificatif" onClick={async () => { const r = await utils.expenses.getReceipt.fetch({ id: e.id }); if (r.receipt) window.open(r.receipt, '_blank'); }}><i className="bi bi-paperclip" /></Button>}
                  {canProcess && e.status === 'draft' && <Button variant="outline-primary" size="sm" className="me-1" title="Valider" onClick={() => validate.mutate({ id: e.id })}><i className="bi bi-check2" /></Button>}
                  {canProcess && e.status !== 'draft' && !e.posted && <Button variant="outline-secondary" size="sm" className="me-1" title="Comptabiliser" onClick={() => post.mutate({ id: e.id })} disabled={post.isPending}><i className="bi bi-journal-plus" /></Button>}
                  {canProcess && e.status === 'validated' && <Button variant="outline-success" size="sm" className="me-1" title="Marquer remboursée" onClick={() => reimburse.mutate({ id: e.id })}><i className="bi bi-cash" /></Button>}
                  {editable && e.status === 'draft' && <Button variant="light" size="sm" className="text-danger" title="Supprimer" onClick={() => remove.mutate({ id: e.id })}><i className="bi bi-trash" /></Button>}
                </td>
              </tr>
            ))}
            {list.isSuccess && rows.length === 0 && <tr><td colSpan={8} className="text-center text-secondary py-4">Aucune note de frais</td></tr>}
          </tbody>
        </Table>
      </Card.Body></Card>

      <Modal show={open} onHide={() => setOpen(false)} centered>
        <Modal.Header closeButton><Modal.Title>Nouvelle note de frais</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <Form.Group className="col-md-6" controlId="exp-date"><Form.Label>Date</Form.Label><Form.Control type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Form.Group>
            <Form.Group className="col-md-6" controlId="exp-category"><Form.Label>Catégorie</Form.Label>
              <Form.Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-12" controlId="exp-desc"><Form.Label>Description</Form.Label><Form.Control value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Objet de la dépense…" /></Form.Group>
            <Form.Group className="col-md-6" controlId="exp-ht"><Form.Label>Montant HT</Form.Label><Form.Control type="number" min={0} step="0.01" value={f.amountHt} onChange={(e) => setF({ ...f, amountHt: e.target.value })} /></Form.Group>
            <Form.Group className="col-md-6" controlId="exp-tva"><Form.Label>TVA %</Form.Label><Form.Control type="number" min={0} step="0.1" value={f.taxRatePct} onChange={(e) => setF({ ...f, taxRatePct: e.target.value })} /></Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={create.isPending || !f.description.trim()}>{create.isPending ? <Spinner size="sm" /> : 'Enregistrer'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
