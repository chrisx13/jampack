import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { formatDuration } from '@jampack/domain';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };

export default function TimeTracking() {
  const utils = trpc.useUtils();
  const can = useCan();
  const editable = can('create', 'Invoice');
  const list = trpc.timeEntries.list.useQuery();
  const companies = trpc.crm.companies.list.useQuery();
  const inv = () => { utils.timeEntries.list.invalidate(); utils.invoices.list.invalidate(); };
  const create = trpc.timeEntries.create.useMutation({ onSuccess: () => { inv(); setOpen(false); } });
  const remove = trpc.timeEntries.remove.useMutation({ onSuccess: inv });
  const invoiceFor = trpc.timeEntries.invoiceForCompany.useMutation({ onSuccess: (r) => { inv(); alert(`${r.count} temps facturé(s) — facture (brouillon) créée, voir l’onglet Factures.`); } });

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), description: '', hours: '1', minutes: '0', companyId: '', hourlyRateHt: '' });
  const rows = list.data ?? [];
  // Clients ayant des temps ouverts + facturables (pour proposer la facturation).
  const billableByCompany = new Map<string, { name: string; count: number }>();
  for (const e of rows) if (e.status === 'open' && e.billable) { const c = billableByCompany.get(e.companyId) ?? { name: e.company?.name ?? '—', count: 0 }; c.count++; billableByCompany.set(e.companyId, c); }

  const submit = () => {
    const minutes = (Number(f.hours) || 0) * 60 + (Number(f.minutes) || 0);
    if (!f.description.trim() || !f.companyId || minutes <= 0) return;
    create.mutate({ date: f.date, description: f.description.trim(), minutes, companyId: f.companyId, hourlyRateHt: num(f.hourlyRateHt), billable: true });
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Suivi du temps</h4><p className="text-secondary mb-0">Temps passé par client — facturation au temps</p></div>
        {editable && <Button onClick={() => { setF({ date: new Date().toISOString().slice(0, 10), description: '', hours: '1', minutes: '0', companyId: '', hourlyRateHt: '' }); setOpen(true); }}><i className="bi bi-plus-lg me-1" />Saisir un temps</Button>}
      </div>

      {billableByCompany.size > 0 && editable && (
        <Card className="mb-3"><Card.Body className="d-flex flex-wrap align-items-center gap-2">
          <span className="text-secondary me-1">À facturer :</span>
          {[...billableByCompany.entries()].map(([id, c]) => (
            <Button key={id} variant="outline-primary" size="sm" disabled={invoiceFor.isPending} onClick={() => invoiceFor.mutate({ id })}>
              <i className="bi bi-receipt me-1" />{c.name} <Badge bg="primary" className="ms-1">{c.count}</Badge>
            </Button>
          ))}
        </Card.Body></Card>
      )}

      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th scope="col" className="ps-3">Date</th><th scope="col">Client</th><th scope="col">Description</th><th scope="col">Durée</th><th scope="col" className="text-end">Taux/h</th><th scope="col" className="text-end">Montant HT</th><th scope="col">Statut</th><th scope="col" className="text-end pe-3"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={8} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="ps-3 text-secondary">{dfmt(e.date)}</td>
                <td>{e.company?.name ?? '—'}</td>
                <td className="fw-medium">{e.description}{!e.billable && <Badge bg="secondary-subtle" text="secondary" className="fw-normal ms-2">non facturable</Badge>}</td>
                <td>{formatDuration(e.minutes)}</td>
                <td className="text-end text-secondary">{euro.format(num(e.hourlyRateHt))}</td>
                <td className="text-end fw-medium">{euro.format(e.amountHt)}</td>
                <td>{e.status === 'invoiced' ? <Badge bg="success-subtle" text="success" className="fw-normal">Facturé</Badge> : <Badge bg="secondary-subtle" text="secondary" className="fw-normal">Ouvert</Badge>}</td>
                <td className="text-end pe-3">
                  {editable && e.status === 'open' && <Button variant="light" size="sm" className="text-danger" title="Supprimer" onClick={() => remove.mutate({ id: e.id })}><i className="bi bi-trash" /></Button>}
                </td>
              </tr>
            ))}
            {list.isSuccess && rows.length === 0 && <tr><td colSpan={8} className="text-center text-secondary py-4">Aucun temps saisi</td></tr>}
          </tbody>
        </Table>
      </Card.Body></Card>

      <Modal show={open} onHide={() => setOpen(false)} centered>
        <Modal.Header closeButton><Modal.Title>Saisir un temps</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-md-6"><Form.Label>Date</Form.Label><Form.Control type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="col-md-6"><Form.Label>Client</Form.Label>
              <Form.Select value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
                <option value="">— Sélectionner —</option>
                {(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-12"><Form.Label>Description</Form.Label><Form.Control value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Tâche réalisée…" /></div>
            <div className="col-md-3"><Form.Label>Heures</Form.Label><Form.Control type="number" min={0} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
            <div className="col-md-3"><Form.Label>Minutes</Form.Label><Form.Control type="number" min={0} max={59} value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></div>
            <div className="col-md-6"><Form.Label>Taux horaire HT</Form.Label><Form.Control type="number" min={0} step="0.01" value={f.hourlyRateHt} onChange={(e) => setF({ ...f, hourlyRateHt: e.target.value })} /></div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={create.isPending || !f.description.trim() || !f.companyId}>{create.isPending ? <Spinner size="sm" /> : 'Enregistrer'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
