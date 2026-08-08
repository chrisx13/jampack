import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge, Alert, Modal } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { computeInvoiceTotals, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@jampack/domain';
import DocumentScanner, { type ScanResult } from '../components/DocumentScanner';

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const orders = trpc.purchases.orders.list.useQuery();
  const match = trpc.supplierInvoices.match.useQuery({ id: id as string }, { enabled: id !== 'new' && !!purchaseOrderId });

  useEffect(() => {
    const inv = existing.data;
    if (!inv) return;
    setSupplierId(inv.supplierId);
    setReference(inv.reference ?? '');
    setIssueDate(inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 10) : '');
    setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '');
    setNotes(inv.notes ?? '');
    setStatus(inv.status);
    setPurchaseOrderId((inv as { purchaseOrderId?: string | null }).purchaseOrderId ?? '');
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

  const [scanOpen, setScanOpen] = useState(false);
  const [postMsg, setPostMsg] = useState<string | null>(null);
  // Pré-remplissage depuis le scanner : référence, date, une ligne depuis les totaux, fournisseur par nom.
  const onScanPrefill = (r: ScanResult) => {
    const d = r.supplierInvoiceDraft;
    if (d.invoiceNumber) setReference(d.invoiceNumber);
    if (d.date) setIssueDate(d.date);
    if (d.supplierName && !supplierId) {
      const needle = d.supplierName.toLowerCase();
      const hit = suppliers.data?.find((s) => s.name.toLowerCase().includes(needle) || needle.includes(s.name.toLowerCase()));
      if (hit) setSupplierId(hit.id);
    }
    if (d.totalHt != null) {
      const rate = d.totalHt > 0 && d.totalTva != null ? Math.round((d.totalTva / d.totalHt) * 1000) / 10 : (num(taxRates.data?.find((t) => t.isDefault)?.rate) || 20);
      setLines([{ label: d.supplierName || d.invoiceNumber || 'Facture fournisseur', quantity: 1, unitPriceHt: d.totalHt, taxRatePct: rate }]);
    }
  };

  const totals = useMemo(() => computeInvoiceTotals(lines), [lines]);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { label: '', quantity: 1, unitPriceHt: 0, taxRatePct: num(taxRates.data?.find((t) => t.isDefault)?.rate) || 20 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, k) => k !== i));

  const payload = () => ({
    supplierId, reference: reference || undefined, issueDate: issueDate || undefined, dueDate: dueDate || undefined, notes: notes || undefined,
    purchaseOrderId: purchaseOrderId || null,
    lines: lines.map((l, i) => ({ label: l.label || 'Ligne', quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: i })),
  });
  const persist = async () => {
    if (id === 'new') { const inv = await create.mutateAsync(payload()); setId(inv.id); return inv.id; }
    await update.mutateAsync({ id, ...payload() });
    return id;
  };
  const refreshLists = () => { utils.supplierInvoices.list.invalidate(); utils.supplierInvoices.echeancier.invalidate(); };
  const onSave = async () => { await persist(); refreshLists(); if (id !== 'new') { utils.supplierInvoices.get.invalidate({ id }); utils.supplierInvoices.match.invalidate({ id }); } };
  const onValidate = async () => { const theId = await persist(); await validate.mutateAsync({ id: theId }); refreshLists(); onClose(); };
  const onPaid = async () => { await markPaid.mutateAsync({ id }); refreshLists(); utils.supplierInvoices.get.invalidate({ id }); };
  const onPost = async () => {
    const r = await postAcc.mutateAsync({ id });
    utils.supplierInvoices.get.invalidate({ id }); utils.accounting.balance.invalidate(); utils.accounting.entries.list.invalidate();
    setPostMsg(r.alreadyPosted ? 'Déjà comptabilisée.' : 'Écriture générée (journal des achats) — voir Comptabilité ▸ Écritures.');
  };
  const onUnpaid = async () => { await markUnpaid.mutateAsync({ id }); refreshLists(); utils.supplierInvoices.get.invalidate({ id }); };

  const err = create.error || update.error || validate.error || markPaid.error || markUnpaid.error;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" aria-label="Retour" onClick={onClose}><i className="bi bi-arrow-left" /></Button>
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
              <Button variant="light" onClick={() => setScanOpen(true)} title="Reconnaître la facture (PDF/photo)"><i className="bi bi-magic me-1" />Scanner</Button>
              <Button variant="light" onClick={onSave} disabled={busy || !supplierId}>{busy ? <Spinner size="sm" /> : <><i className="bi bi-save me-1" />Enregistrer</>}</Button>
              <Button onClick={onValidate} disabled={busy || !supplierId || lines.length === 0}><i className="bi bi-check2-circle me-1" />Valider</Button>
            </>
          )}
        </div>
      </div>

      {postMsg && <Alert variant="success" dismissible onClose={() => setPostMsg(null)} className="py-2"><i className="bi bi-journal-check me-1" />{postMsg}</Alert>}

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
            <div className="col-md-6">
              <Form.Label>Commande rattachée (rapprochement 3 voies)</Form.Label>
              <Form.Select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} disabled={readOnly}>
                <option value="">— Aucune —</option>
                {(orders.data ?? []).filter((o) => !supplierId || o.supplierId === supplierId).map((o) => (
                  <option key={o.id} value={o.id}>{o.number ?? 'brouillon'} · {o.status}</option>
                ))}
              </Form.Select>
            </div>
          </div>
        </Card.Body>
      </Card>

      {match.data?.linked && (
        <Card className="mb-3 border-0" style={{ background: match.data.ok ? 'var(--bs-success-bg-subtle)' : 'var(--bs-warning-bg-subtle)' }}>
          <Card.Body className="py-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="fw-semibold">
                <i className={`bi ${match.data.ok ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-warning'} me-2`} />
                Rapprochement 3 voies — commande {match.data.poNumber ?? '—'}
              </div>
              <div className="d-flex gap-4 small">
                <span>Commandé HT <strong>{euro.format(match.data.orderedHt)}</strong></span>
                <span>Facturé HT <strong>{euro.format(match.data.invoicedHt)}</strong></span>
                <span>Écart <strong className={Math.abs(match.data.variance) > 0.01 ? 'text-danger' : 'text-success'}>{euro.format(match.data.variance)}</strong></span>
                <span>Réception <strong>{match.data.receivedRatio}%</strong></span>
              </div>
            </div>
            {!match.data.ok && (
              <div className="small text-secondary mt-2">
                {match.data.overInvoiced && <span className="me-3"><i className="bi bi-cash-coin me-1" />Facturé au-delà de la commande.</span>}
                {!match.data.priceMatch && !match.data.overInvoiced && <span className="me-3"><i className="bi bi-tag me-1" />Écart de montant commande/facture.</span>}
                {!match.data.receptionComplete && <span><i className="bi bi-box-seam me-1" />Réception incomplète.</span>}
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      <Card className="mb-3">
        <Card.Body className="p-0">
          <Table className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Désignation</th><th scope="col" className="text-end" style={{ width: 100 }}>Qté</th><th scope="col" className="text-end" style={{ width: 130 }}>PU HT</th><th scope="col" className="text-end" style={{ width: 110 }}>TVA</th><th scope="col" className="text-end" style={{ width: 130 }}>Total HT</th><th scope="col" style={{ width: 50 }} /></tr>
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
      {(status === 'validated' || status === 'paid') && id !== 'new' && (
        <SupplierPaymentsCard supplierInvoiceId={id} totalTtc={totals.totalTtc} />
      )}
      {err && <div className="text-danger small mt-2">{err.message}</div>}

      <DocumentScanner show={scanOpen} onClose={() => setScanOpen(false)} onPrefill={onScanPrefill} />
    </>
  );
}

/** Décaissements d'une facture fournisseur : liste, ajout, reste dû, comptabilisation (401=512). */
function SupplierPaymentsCard({ supplierInvoiceId, totalTtc }: { supplierInvoiceId: string; totalTtc: number }) {
  const utils = trpc.useUtils();
  const can = useCan();
  const list = trpc.supplierPayments.listForInvoice.useQuery({ supplierInvoiceId });
  const create = trpc.supplierPayments.create.useMutation();
  const remove = trpc.supplierPayments.remove.useMutation();
  const postPay = trpc.accounting.postSupplierPayment.useMutation();

  const paid = (list.data ?? []).reduce((s, p) => s + num(p.amount), 0);
  const remaining = Math.round((totalTtc - paid) * 100) / 100;

  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('virement');
  const [date, setDate] = useState('');
  const [reference, setReference] = useState('');
  const [confirmDel, setConfirmDel] = useState<null | { id: string; amount: number }>(null);
  useEffect(() => { setAmount(remaining > 0 ? remaining : 0); }, [list.data]); // montant réinitialisé au reste dû

  const refresh = () => {
    utils.supplierPayments.listForInvoice.invalidate({ supplierInvoiceId });
    utils.supplierInvoices.get.invalidate({ id: supplierInvoiceId });
    utils.supplierInvoices.list.invalidate();
    utils.supplierInvoices.echeancier.invalidate();
  };
  const add = async () => {
    if (!(amount > 0)) return;
    await create.mutateAsync({ supplierInvoiceId, amount, method, date: date || undefined, reference: reference || undefined });
    setReference(''); refresh();
  };
  const del = async (id: string) => { await remove.mutateAsync({ id }); refresh(); };
  const post = async (id: string) => { await postPay.mutateAsync({ id }); utils.supplierPayments.listForInvoice.invalidate({ supplierInvoiceId }); utils.accounting.balance.invalidate(); utils.accounting.entries.list.invalidate(); };

  return (
    <Card className="mt-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0 fw-semibold"><i className="bi bi-cash-coin me-2" />Règlements fournisseur</h6>
          <div className="small">
            <span className="text-secondary me-3">Réglé <span className="fw-medium text-body">{euro.format(paid)}</span></span>
            <span className={remaining > 0 ? 'text-danger' : 'text-success'}>Reste dû <span className="fw-semibold">{euro.format(remaining)}</span></span>
          </div>
        </div>

        <Table size="sm" className="align-middle mb-2">
          <tbody>
            {(list.data ?? []).map((p) => (
              <tr key={p.id}>
                <td className="text-secondary" style={{ width: 110 }}>{dfmt(p.date)}</td>
                <td>{PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}</td>
                <td className="text-secondary">{p.reference}</td>
                <td className="text-end fw-medium">{euro.format(num(p.amount))}</td>
                <td className="text-end" style={{ width: 90 }}>
                  {p.journalEntryId
                    ? <i className="bi bi-journal-check text-success me-1" title="Comptabilisé" />
                    : can('create', 'Accounting') && <Button variant="light" size="sm" className="me-1" title="Comptabiliser (journal banque)" onClick={() => post(p.id)}><i className="bi bi-journal-plus" /></Button>}
                  {!p.journalEntryId && can('update', 'SupplierInvoice') && <Button variant="light" size="sm" className="text-danger" title="Supprimer le règlement" onClick={() => setConfirmDel({ id: p.id, amount: num(p.amount) })}><i className="bi bi-trash" /></Button>}
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-2">Aucun règlement</td></tr>}
          </tbody>
        </Table>

        {can('update', 'SupplierInvoice') && remaining > 0 && (
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-3">
              <Form.Label className="small mb-1">Montant</Form.Label>
              <Form.Control size="sm" type="number" step="0.01" value={amount} onChange={(e) => setAmount(num(e.target.value))} />
            </div>
            <div className="col-6 col-md-3">
              <Form.Label className="small mb-1">Moyen</Form.Label>
              <Form.Select size="sm" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
              </Form.Select>
            </div>
            <div className="col-6 col-md-2">
              <Form.Label className="small mb-1">Date</Form.Label>
              <Form.Control size="sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <Form.Label className="small mb-1">Référence</Form.Label>
              <Form.Control size="sm" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="col-12 col-md-2">
              <Button size="sm" className="w-100" onClick={add} disabled={create.isPending || !(amount > 0)}><i className="bi bi-plus-lg me-1" />Régler</Button>
            </div>
          </div>
        )}
        {create.error && <div className="text-danger small mt-2">{create.error.message}</div>}

        <Modal show={!!confirmDel} onHide={() => setConfirmDel(null)} centered>
          <Modal.Header closeButton><Modal.Title className="fs-6">Supprimer le règlement</Modal.Title></Modal.Header>
          <Modal.Body>Supprimer ce règlement de <strong>{confirmDel ? euro.format(confirmDel.amount) : ''}</strong> ? Cette action est irréversible.</Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setConfirmDel(null)}>Annuler</Button>
            <Button variant="danger" disabled={remove.isPending} onClick={async () => { if (confirmDel) { await del(confirmDel.id); setConfirmDel(null); } }}>{remove.isPending ? <Spinner size="sm" /> : 'Supprimer'}</Button>
          </Modal.Footer>
        </Modal>
      </Card.Body>
    </Card>
  );
}

export default function SupplierInvoices() {
  const list = trpc.supplierInvoices.list.useQuery();
  const can = useCan();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [search, setSearch] = useState('');

  if (editing) return <Editor id={editing} onClose={() => setEditing(null)} />;

  const all = (list.data ?? []) as { id: string; reference?: string | null; status: string; issueDate?: unknown; dueDate?: unknown; totalTtc: number; supplier?: { name?: string } }[];
  const q = search.trim().toLowerCase();
  const rows = q ? all.filter((r) => (r.reference ?? '').toLowerCase().includes(q) || (r.supplier?.name ?? '').toLowerCase().includes(q)) : all;
  const showSearch = all.length > 5;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Factures fournisseurs</h4><p className="text-secondary mb-0">Comptes à payer</p></div>
        {can('create', 'SupplierInvoice') && <Button onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />Nouvelle facture</Button>}
      </div>

      {showSearch && (
        <div className="position-relative mb-3" style={{ maxWidth: 360 }}>
          <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
          <input className="form-control form-control-sm ps-4" aria-label="Rechercher une facture fournisseur" placeholder="Rechercher (référence ou fournisseur)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Référence</th><th scope="col">Fournisseur</th><th scope="col">Date</th><th scope="col">Échéance</th><th scope="col" className="text-end">Total TTC</th><th scope="col">Statut</th><th scope="col" className="pe-3"><span className="visually-hidden">Ouvrir</span></th></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r.id)}>
                  <td className="ps-3 fw-medium">
                    <button type="button" className="btn btn-link p-0 text-decoration-none text-body fw-medium" onClick={(e) => { e.stopPropagation(); setEditing(r.id); }}>{r.reference ?? <span className="text-secondary fst-italic">brouillon</span>}<span className="visually-hidden"> — ouvrir</span></button>
                  </td>
                  <td>{r.supplier?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.issueDate)}</td>
                  <td className="text-secondary">{dfmt(r.dueDate)}</td>
                  <td className="text-end fw-medium">{euro.format(r.totalTtc)}</td>
                  <td><StatusBadge s={r.status} /></td>
                  <td className="text-end pe-3"><i className="bi bi-chevron-right text-secondary" aria-hidden="true" /></td>
                </tr>
              ))}
              {list.isSuccess && all.length === 0 && (
                <tr><td colSpan={7} className="text-center text-secondary py-5">
                  <div className="mb-2"><i className="bi bi-receipt-cutoff fs-3 opacity-50" aria-hidden="true" /></div>
                  <div className="mb-3">Aucune facture fournisseur pour l'instant.</div>
                  {can('create', 'SupplierInvoice') && <Button size="sm" onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" aria-hidden="true" />Nouvelle facture</Button>}
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
