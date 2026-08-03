import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { computeInvoiceTotals } from '@jampack/domain';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Brouillon', bg: 'secondary-subtle', text: 'secondary' },
  validated: { label: 'À payer', bg: 'info-subtle', text: 'info' },
  paid: { label: 'Payée', bg: 'success-subtle', text: 'success' },
  cancelled: { label: 'Annulée', bg: 'danger-subtle', text: 'danger' },
};
function StatusBadge({ s }: { s: string }) {
  const c = STATUS[s] ?? STATUS.draft;
  return <Badge bg={c.bg} text={c.text} className="fw-normal">{c.label}</Badge>;
}

type Line = { label: string; quantity: number; unitPriceHt: number; taxRatePct: number };

function Editor({ id: initialId, onClose }: { id: string | 'new'; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [id, setId] = useState<string | 'new'>(initialId);
  const suppliers = trpc.purchases.suppliers.useQuery();
  const taxRates = trpc.catalog.taxRates.list.useQuery();
  const existing = trpc.supplierInvoices.get.useQuery({ id: id as string }, { enabled: id !== 'new' });

  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    const inv = existing.data;
    if (!inv) return;
    setSupplierId(inv.supplierId);
    setReference(inv.reference ?? '');
    setIssueDate(inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 10) : '');
    setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '');
    setNotes(inv.notes ?? '');
    setStatus(inv.status);
    setLines(inv.lines.map((l) => ({ label: l.label, quantity: num(l.quantity), unitPriceHt: num(l.unitPriceHt), taxRatePct: num(l.taxRatePct) })));
  }, [existing.data]);

  const create = trpc.supplierInvoices.create.useMutation();
  const update = trpc.supplierInvoices.update.useMutation();
  const validate = trpc.supplierInvoices.validate.useMutation();
  const markPaid = trpc.supplierInvoices.markPaid.useMutation();
  const markUnpaid = trpc.supplierInvoices.markUnpaid.useMutation();
  const postAcc = trpc.accounting.postSupplierInvoice.useMutation();
  const posted = !!existing.data?.journalEntryId;
  const busy = create.isPending || update.isPending || validate.isPending || markPaid.isPending || markUnpaid.isPending || postAcc.isPending;
  const readOnly = status !== 'draft';

  const totals = useMemo(() => computeInvoiceTotals(lines), [lines]);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { label: '', quantity: 1, unitPriceHt: 0, taxRatePct: num(taxRates.data?.find((t) => t.isDefault)?.rate) || 20 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, k) => k !== i));

  const payload = () => ({
    supplierId, reference: reference || undefined, issueDate: issueDate || undefined, dueDate: dueDate || undefined, notes: notes || undefined,
    lines: lines.map((l, i) => ({ label: l.label || 'Ligne', quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: i })),
  });
  const persist = async () => {
    if (id === 'new') { const inv = await create.mutateAsync(payload()); setId(inv.id); return inv.id; }
    await update.mutateAsync({ id, ...payload() });
    return id;
  };
  const refreshLists = () => { utils.supplierInvoices.list.invalidate(); utils.supplierInvoices.echeancier.invalidate(); };
  const onSave = async () => { await persist(); refreshLists(); if (id !== 'new') utils.supplierInvoices.get.invalidate({ id }); };
  const onValidate = async () => { const theId = await persist(); await validate.mutateAsync({ id: theId }); refreshLists(); onClose(); };
  const onPaid = async () => { await markPaid.mutateAsync({ id }); refreshLists(); utils.supplierInvoices.get.invalidate({ id }); };
  const onPost = async () => {
    const r = await postAcc.mutateAsync({ id });
    utils.supplierInvoices.get.invalidate({ id }); utils.accounting.balance.invalidate(); utils.accounting.entries.list.invalidate();
    alert(r.alreadyPosted ? 'Déjà comptabilisée.' : 'Écriture générée (journal des achats) — voir Comptabilité ▸ Écritures.');
  };
  const onUnpaid = async () => { await markUnpaid.mutateAsync({ id }); refreshLists(); utils.supplierInvoices.get.invalidate({ id }); };

  const err = create.error || update.error || validate.error || markPaid.error || markUnpaid.error;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" onClick={onClose}><i className="bi bi-arrow-left" /></Button>
          <div>
            <h4 className="mb-1 fw-semibold">{reference ? `Facture ${reference}` : id === 'new' ? 'Nouvelle facture fournisseur' : 'Facture fournisseur'}</h4>
            <StatusBadge s={status} />
          </div>
        </div>
        <div className="d-flex gap-2">
          {readOnly && status !== 'cancelled' && (
            <Button variant={posted ? 'success' : 'outline-primary'} onClick={onPost} disabled={busy || posted}>
              <i className={`bi ${posted ? 'bi-journal-check' : 'bi-journal-plus'} me-1`} />{posted ? 'Comptabilisée' : 'Comptabiliser'}
            </Button>
          )}
          {status === 'validated' && <Button variant="success" onClick={onPaid} disabled={busy}><i className="bi bi-cash-coin me-1" />Marquer payée</Button>}
          {status === 'paid' && <Button variant="outline-secondary" onClick={onUnpaid} disabled={busy}><i className="bi bi-arrow-counterclockwise me-1" />Annuler le paiement</Button>}
          {!readOnly && (
            <>
              <Button variant="light" onClick={onSave} disabled={busy || !supplierId}>{busy ? <Spinner size="sm" /> : <><i className="bi bi-save me-1" />Enregistrer</>}</Button>
              <Button onClick={onValidate} disabled={busy || !supplierId || lines.length === 0}><i className="bi bi-check2-circle me-1" />Valider</Button>
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
            </div>
            <div className="col-md-3">
              <Form.Label>N° facture fournisseur</Form.Label>
              <Form.Control value={reference} onChange={(e) => setReference(e.target.value)} disabled={readOnly} />
            </div>
            <div className="col-md-2">
              <Form.Label>Date</Form.Label>
              <Form.Control type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={readOnly} />
            </div>
            <div className="col-md-2">
              <Form.Label>Échéance</Form.Label>
              <Form.Control type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={readOnly} />
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body className="p-0">
          <Table className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Désignation</th><th className="text-end" style={{ width: 100 }}>Qté</th><th className="text-end" style={{ width: 130 }}>PU HT</th><th className="text-end" style={{ width: 110 }}>TVA</th><th className="text-end" style={{ width: 130 }}>Total HT</th><th style={{ width: 50 }} /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="ps-3"><Form.Control size="sm" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} disabled={readOnly} /></td>
                  <td><Form.Control size="sm" type="number" step="0.001" className="text-end" value={l.quantity} onChange={(e) => setLine(i, { quantity: num(e.target.value) })} disabled={readOnly} /></td>
                  <td><Form.Control size="sm" type="number" step="0.01" className="text-end" value={l.unitPriceHt} onChange={(e) => setLine(i, { unitPriceHt: num(e.target.value) })} disabled={readOnly} /></td>
                  <td>
                    <Form.Select size="sm" value={String(l.taxRatePct)} onChange={(e) => setLine(i, { taxRatePct: num(e.target.value) })} disabled={readOnly}>
                      {[...new Set([...(taxRates.data?.map((t) => num(t.rate)) ?? []), l.taxRatePct])].sort((a, b) => b - a).map((r) => <option key={r} value={r}>{r} %</option>)}
                    </Form.Select>
                  </td>
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

      <div className="row">
        <div className="col-md-7">
          <Form.Label>Notes</Form.Label>
          <Form.Control as="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} />
        </div>
        <div className="col-md-5">
          <Card><Card.Body>
            <div className="d-flex justify-content-between mb-1"><span className="text-secondary">Total HT</span><span className="fw-medium">{euro.format(totals.totalHt)}</span></div>
            <div className="d-flex justify-content-between mb-1"><span className="text-secondary">TVA</span><span className="fw-medium">{euro.format(totals.totalTva)}</span></div>
            <hr className="my-2" />
            <div className="d-flex justify-content-between"><span className="fw-semibold">Total TTC</span><span className="fw-semibold fs-5">{euro.format(totals.totalTtc)}</span></div>
          </Card.Body></Card>
        </div>
      </div>
      {err && <div className="text-danger small mt-2">{err.message}</div>}
    </>
  );
}

export default function SupplierInvoices() {
  const list = trpc.supplierInvoices.list.useQuery();
  const can = useCan();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  if (editing) return <Editor id={editing} onClose={() => setEditing(null)} />;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Factures fournisseurs</h4><p className="text-secondary mb-0">Comptes à payer</p></div>
        {can('create', 'SupplierInvoice') && <Button onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />Nouvelle facture</Button>}
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Référence</th><th>Fournisseur</th><th>Date</th><th>Échéance</th><th className="text-end">Total TTC</th><th>Statut</th><th className="pe-3" /></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {list.data?.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r.id)}>
                  <td className="ps-3 fw-medium">{r.reference ?? <span className="text-secondary fst-italic">brouillon</span>}</td>
                  <td>{r.supplier?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.issueDate)}</td>
                  <td className="text-secondary">{dfmt(r.dueDate)}</td>
                  <td className="text-end fw-medium">{euro.format(r.totalTtc)}</td>
                  <td><StatusBadge s={r.status} /></td>
                  <td className="text-end pe-3"><i className="bi bi-chevron-right text-secondary" /></td>
                </tr>
              ))}
              {list.data?.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucune facture fournisseur</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
