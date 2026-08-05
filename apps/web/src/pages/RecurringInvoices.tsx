import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { recurrenceLabel, RECURRENCE_FREQUENCIES, computeInvoiceTotals } from '@jampack/domain';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };
type Line = { label: string; quantity: number; unitPriceHt: number; taxRatePct: number };

function Editor({ id, onClose }: { id: string | 'new'; onClose: () => void }) {
  const utils = trpc.useUtils();
  const companies = trpc.crm.companies.list.useQuery();
  const products = trpc.catalog.products.list.useQuery();
  const existing = trpc.recurring.list.useQuery();
  const cur = id !== 'new' ? (existing.data ?? []).find((r) => r.id === id) : undefined;

  const [companyId, setCompanyId] = useState(cur?.companyId ?? '');
  const [label, setLabel] = useState(cur?.label ?? '');
  const [frequency, setFrequency] = useState(cur?.frequency ?? 'monthly');
  const [interval, setIntervalV] = useState(String(cur?.interval ?? 1));
  const [nextRunAt, setNextRunAt] = useState(cur?.nextRunAt ? new Date(cur.nextRunAt as unknown as string).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [active, setActive] = useState(cur?.active ?? true);
  const [lines, setLines] = useState<Line[]>((cur?.lines as unknown as Line[]) ?? [{ label: '', quantity: 1, unitPriceHt: 0, taxRatePct: 20 }]);

  const create = trpc.recurring.create.useMutation({ onSuccess: () => { utils.recurring.list.invalidate(); onClose(); } });
  const update = trpc.recurring.update.useMutation({ onSuccess: () => { utils.recurring.list.invalidate(); onClose(); } });
  const busy = create.isPending || update.isPending;
  const totals = computeInvoiceTotals(lines);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const save = () => {
    if (!companyId || !label.trim() || lines.length === 0) return;
    const payload = { companyId, label: label.trim(), frequency: frequency as 'monthly', interval: Number(interval) || 1, nextRunAt: new Date(nextRunAt).toISOString(), active, discountType: 'none' as const, discountValue: 0, lines: lines.map((l) => ({ label: l.label || 'Ligne', quantity: num(l.quantity), unitPriceHt: num(l.unitPriceHt), taxRatePct: num(l.taxRatePct) })) };
    if (id === 'new') create.mutate(payload); else update.mutate({ id, ...payload });
  };

  return (
    <Modal show onHide={onClose} centered size="lg">
      <Modal.Header closeButton><Modal.Title>{id === 'new' ? 'Nouvel abonnement' : 'Modifier l’abonnement'}</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="row g-2 mb-3">
          <div className="col-md-6"><Form.Label>Client</Form.Label>
            <Form.Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-6"><Form.Label>Libellé</Form.Label><Form.Control value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Maintenance mensuelle…" /></div>
          <div className="col-md-4"><Form.Label>Fréquence</Form.Label>
            <Form.Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {RECURRENCE_FREQUENCIES.map((f) => <option key={f} value={f}>{recurrenceLabel(f)}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-4"><Form.Label>Tous les</Form.Label><Form.Control type="number" min={1} value={interval} onChange={(e) => setIntervalV(e.target.value)} /></div>
          <div className="col-md-4"><Form.Label>Prochaine échéance</Form.Label><Form.Control type="date" value={nextRunAt} onChange={(e) => setNextRunAt(e.target.value)} /></div>
        </div>

        <Table size="sm" className="align-middle mb-2">
          <thead className="text-secondary small"><tr><th>Désignation</th><th style={{ width: 80 }}>Qté</th><th style={{ width: 110 }}>PU HT</th><th style={{ width: 90 }}>TVA %</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <Form.Select size="sm" className="mb-1" value="" onChange={(e) => { const p = products.data?.find((x) => x.id === e.target.value); if (p) setLine(i, { label: p.name, unitPriceHt: num(p.priceHt), taxRatePct: num(p.taxRate?.rate) || 20 }); }}>
                    <option value="">— article —</option>
                    {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Form.Select>
                  <Form.Control size="sm" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder="Désignation" />
                </td>
                <td><Form.Control size="sm" type="number" value={l.quantity} onChange={(e) => setLine(i, { quantity: num(e.target.value) })} /></td>
                <td><Form.Control size="sm" type="number" value={l.unitPriceHt} onChange={(e) => setLine(i, { unitPriceHt: num(e.target.value) })} /></td>
                <td><Form.Control size="sm" type="number" value={l.taxRatePct} onChange={(e) => setLine(i, { taxRatePct: num(e.target.value) })} /></td>
                <td><Button variant="link" size="sm" className="text-danger p-0" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}><i className="bi bi-x-lg" /></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="d-flex justify-content-between align-items-center">
          <Button variant="light" size="sm" onClick={() => setLines((ls) => [...ls, { label: '', quantity: 1, unitPriceHt: 0, taxRatePct: 20 }])}><i className="bi bi-plus-lg me-1" />Ligne</Button>
          <span className="text-secondary">TTC par échéance : <strong>{euro.format(totals.totalTtc)}</strong></span>
        </div>
        <Form.Check className="mt-3" type="switch" id="rec-active" label="Actif" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onClose}>Annuler</Button>
        <Button onClick={save} disabled={busy || !companyId || !label.trim()}>{busy ? <Spinner size="sm" /> : 'Enregistrer'}</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function RecurringInvoices() {
  const utils = trpc.useUtils();
  const can = useCan();
  const editable = can('create', 'Invoice');
  const list = trpc.recurring.list.useQuery();
  const remove = trpc.recurring.remove.useMutation({ onSuccess: () => utils.recurring.list.invalidate() });
  const generate = trpc.recurring.generateDue.useMutation({ onSuccess: (r) => { utils.recurring.list.invalidate(); utils.invoices.list.invalidate(); alert(`${r.generated} facture(s) générée(s) en brouillon — voir l’onglet Factures.`); } });
  const [edit, setEdit] = useState<string | 'new' | null>(null);
  const rows = list.data ?? [];

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div><h4 className="mb-1 fw-semibold">Factures récurrentes</h4><p className="text-secondary mb-0">Abonnements : génération des factures dues en brouillon</p></div>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={() => generate.mutate()} disabled={generate.isPending}><i className="bi bi-arrow-repeat me-1" />Générer les factures dues</Button>
          {editable && <Button onClick={() => setEdit('new')}><i className="bi bi-plus-lg me-1" />Nouvel abonnement</Button>}
        </div>
      </div>

      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th scope="col" className="ps-3">Libellé</th><th scope="col">Client</th><th scope="col">Fréquence</th><th scope="col">Prochaine échéance</th><th scope="col">Statut</th><th scope="col" className="text-end pe-3"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={6} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {rows.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEdit(r.id)}>
                <td className="ps-3 fw-medium">{r.label}</td>
                <td>{r.company?.name ?? '—'}</td>
                <td>{recurrenceLabel(r.frequency)}{r.interval > 1 ? ` ×${r.interval}` : ''}</td>
                <td className="text-secondary">{dfmt(r.nextRunAt)}</td>
                <td>{r.active ? <Badge bg="success-subtle" text="success" className="fw-normal">Actif</Badge> : <Badge bg="secondary-subtle" text="secondary" className="fw-normal">Suspendu</Badge>}</td>
                <td className="text-end pe-3" onClick={(e) => e.stopPropagation()}>
                  {can('update', 'Invoice') && <Button variant="light" size="sm" className="text-danger" title="Supprimer" onClick={() => { if (confirm(`Supprimer l’abonnement « ${r.label} » ?`)) remove.mutate({ id: r.id }); }}><i className="bi bi-trash" /></Button>}
                </td>
              </tr>
            ))}
            {list.isSuccess && rows.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Aucun abonnement</td></tr>}
          </tbody>
        </Table>
      </Card.Body></Card>

      {edit && <Editor id={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
