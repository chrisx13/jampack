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
  validated: { label: 'Validée', bg: 'success-subtle', text: 'success' },
  paid: { label: 'Payée', bg: 'primary-subtle', text: 'primary' },
  cancelled: { label: 'Annulée', bg: 'danger-subtle', text: 'danger' },
};
function StatusBadge({ s }: { s: string }) {
  const c = STATUS[s] ?? STATUS.draft;
  return <Badge bg={c.bg} text={c.text} className="fw-normal">{c.label}</Badge>;
}

type Line = { productId?: string; label: string; quantity: number; unitPriceHt: number; taxRatePct: number };

function InvoiceEditor({ id: initialId, onClose }: { id: string | 'new'; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [id, setId] = useState<string | 'new'>(initialId);
  const companies = trpc.crm.companies.list.useQuery();
  const products = trpc.catalog.products.list.useQuery();
  const taxRates = trpc.catalog.taxRates.list.useQuery();
  const existing = trpc.invoices.get.useQuery({ id: id as string }, { enabled: id !== 'new' });

  const [companyId, setCompanyId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState('draft');
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    const inv = existing.data;
    if (!inv) return;
    setCompanyId(inv.companyId);
    setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '');
    setNotes(inv.notes ?? '');
    setStatus(inv.status);
    setNumber(inv.number ?? null);
    setLines(inv.lines.map((l) => ({ productId: l.productId ?? undefined, label: l.label, quantity: num(l.quantity), unitPriceHt: num(l.unitPriceHt), taxRatePct: num(l.taxRatePct) })));
  }, [existing.data]);

  const create = trpc.invoices.create.useMutation();
  const update = trpc.invoices.update.useMutation();
  const validate = trpc.invoices.validate.useMutation();
  const busy = create.isPending || update.isPending || validate.isPending;
  const readOnly = status !== 'draft';
  const pdf = useInvoicePdf();

  const totals = useMemo(() => computeInvoiceTotals(lines), [lines]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { label: '', quantity: 1, unitPriceHt: 0, taxRatePct: num(taxRates.data?.find((t) => t.isDefault)?.rate) || 20 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, k) => k !== i));

  const onPickProduct = (i: number, productId: string) => {
    const p = products.data?.find((x) => x.id === productId);
    if (!p) { setLine(i, { productId: undefined }); return; }
    setLine(i, { productId, label: p.name, unitPriceHt: num(p.priceHt), taxRatePct: num(p.taxRate?.rate) || 0 });
  };

  const payload = () => ({
    companyId,
    dueDate: dueDate || undefined,
    notes: notes || undefined,
    lines: lines.map((l, i) => ({ productId: l.productId, label: l.label || 'Ligne', quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: i })),
  });
  const persist = async () => {
    if (id === 'new') { const inv = await create.mutateAsync(payload()); setId(inv.id); return inv.id; }
    await update.mutateAsync({ id, ...payload() });
    return id;
  };
  const onSave = async () => { await persist(); utils.invoices.list.invalidate(); if (id !== 'new') utils.invoices.get.invalidate({ id }); };
  const onValidate = async () => { const theId = await persist(); await validate.mutateAsync({ id: theId }); utils.invoices.list.invalidate(); onClose(); };

  const err = create.error || update.error || validate.error;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" onClick={onClose}><i className="bi bi-arrow-left" /></Button>
          <div>
            <h4 className="mb-1 fw-semibold">{number ? `Facture ${number}` : id === 'new' ? 'Nouvelle facture' : 'Facture (brouillon)'}</h4>
            <StatusBadge s={status} />
          </div>
        </div>
        <div className="d-flex gap-2">
          {id !== 'new' && (
            <Button variant="light" title="Télécharger le PDF" disabled={pdf.pending} onClick={() => pdf.download(id)}>
              <i className="bi bi-filetype-pdf me-1" />PDF
            </Button>
          )}
          {!readOnly && (
            <>
              <Button variant="light" onClick={onSave} disabled={busy || !companyId}>{busy ? <Spinner size="sm" /> : <><i className="bi bi-save me-1" />Enregistrer</>}</Button>
              <Button onClick={onValidate} disabled={busy || !companyId || lines.length === 0}><i className="bi bi-check2-circle me-1" />Valider</Button>
            </>
          )}
        </div>
      </div>

      <Card className="mb-3">
        <Card.Body>
          <div className="row g-3">
            <div className="col-md-6">
              <Form.Label>Client</Form.Label>
              <Form.Select value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={readOnly}>
                <option value="">— Sélectionner —</option>
                {companies.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
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
              <tr><th className="ps-3" style={{ width: 200 }}>Article</th><th>Désignation</th><th className="text-end" style={{ width: 90 }}>Qté</th><th className="text-end" style={{ width: 120 }}>PU HT</th><th className="text-end" style={{ width: 110 }}>TVA</th><th className="text-end" style={{ width: 120 }}>Total HT</th><th style={{ width: 50 }} /></tr>
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
                  <td>
                    <Form.Select size="sm" value={String(l.taxRatePct)} onChange={(e) => setLine(i, { taxRatePct: num(e.target.value) })} disabled={readOnly}>
                      {[...new Set([...(taxRates.data?.map((t) => num(t.rate)) ?? []), l.taxRatePct])].sort((a, b) => b - a).map((r) => (
                        <option key={r} value={r}>{r} %</option>
                      ))}
                    </Form.Select>
                  </td>
                  <td className="text-end">{euro.format(l.quantity * l.unitPriceHt)}</td>
                  <td className="text-end pe-2">{!readOnly && <Button variant="light" size="sm" className="text-danger" onClick={() => removeLine(i)}><i className="bi bi-trash" /></Button>}</td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucune ligne</td></tr>}
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
          <Card>
            <Card.Body>
              <div className="d-flex justify-content-between mb-1"><span className="text-secondary">Total HT</span><span className="fw-medium">{euro.format(totals.totalHt)}</span></div>
              <div className="d-flex justify-content-between mb-1"><span className="text-secondary">TVA</span><span className="fw-medium">{euro.format(totals.totalTva)}</span></div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between"><span className="fw-semibold">Total TTC</span><span className="fw-semibold fs-5">{euro.format(totals.totalTtc)}</span></div>
            </Card.Body>
          </Card>
        </div>
      </div>
      {err && <div className="text-danger small mt-2">{err.message}</div>}
    </>
  );
}

function useInvoicePdf() {
  const pdf = trpc.invoices.pdf.useMutation();
  const download = async (id: string) => {
    const r = await pdf.mutateAsync({ id });
    const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = r.filename; a.click();
    URL.revokeObjectURL(url);
  };
  return { download, pending: pdf.isPending };
}

export default function Factures() {
  const list = trpc.invoices.list.useQuery();
  const can = useCan();
  const pdf = useInvoicePdf();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  if (editing) return <InvoiceEditor id={editing} onClose={() => setEditing(null)} />;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Factures</h4><p className="text-secondary mb-0">Ventes & facturation</p></div>
        {can('create', 'Invoice') && <Button onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />Nouvelle facture</Button>}
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Numéro</th><th>Client</th><th>Émission</th><th>Échéance</th><th className="text-end">Total TTC</th><th>Statut</th><th className="text-end pe-3" /></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {list.data?.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r.id)}>
                  <td className="ps-3 fw-medium">{r.number ?? <span className="text-secondary fst-italic">brouillon</span>}</td>
                  <td>{r.company?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.issueDate)}</td>
                  <td className="text-secondary">{dfmt(r.dueDate)}</td>
                  <td className="text-end fw-medium">{euro.format(r.totalTtc)}</td>
                  <td><StatusBadge s={r.status} /></td>
                  <td className="text-end pe-3" onClick={(e) => e.stopPropagation()}>
                    <Button variant="light" size="sm" className="me-1" title="Télécharger le PDF" disabled={pdf.pending} onClick={() => pdf.download(r.id)}>
                      <i className="bi bi-filetype-pdf" />
                    </Button>
                    <i className="bi bi-chevron-right text-secondary" />
                  </td>
                </tr>
              ))}
              {list.data?.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucune facture pour cette société</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
