import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { computeInvoiceTotals, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@jampack/domain';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

type StatusStyle = { label: string; bg: string; text: string };

export type SalesCfg = {
  key: 'quotes' | 'invoices' | 'creditNotes';
  subject: string;              // sujet CASL
  singular: string;             // « Facture »
  plural: string;               // « Factures »
  subtitle: string;
  newLabel: string;             // « Nouvelle facture »
  issueLabel: string;           // « Valider » / « Envoyer »
  dateLabel: string | null;     // en-tête colonne 2e date (null = masquée)
  dateField: 'dueDate' | 'validUntil' | null;
  showBilling: boolean;         // bloc conditions/banque/affacturage
  statuses: Record<string, StatusStyle>;
};

function StatusBadge({ s, cfg }: { s: string; cfg: SalesCfg }) {
  const c = cfg.statuses[s] ?? { label: s, bg: 'secondary-subtle', text: 'secondary' };
  return <Badge bg={c.bg} text={c.text} className="fw-normal">{c.label}</Badge>;
}

type Line = { productId?: string; label: string; quantity: number; unitPriceHt: number; taxRatePct: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function usePdf(api: any) {
  const pdf = api.pdf.useMutation();
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

function Editor({ cfg, id: initialId, onClose }: { cfg: SalesCfg; id: string | 'new'; onClose: () => void }) {
  const utils = trpc.useUtils();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (trpc as any)[cfg.key];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uapi = (utils as any)[cfg.key];
  const [id, setId] = useState<string | 'new'>(initialId);
  const companies = trpc.crm.companies.list.useQuery();
  const products = trpc.catalog.products.list.useQuery();
  const taxRates = trpc.catalog.taxRates.list.useQuery();
  const existing = api.get.useQuery({ id: id as string }, { enabled: id !== 'new' });
  const paymentTerms = trpc.billing.paymentTerms.list.useQuery();
  const bankAccounts = trpc.billing.bankAccounts.list.useQuery();
  const factors = trpc.billing.factors.list.useQuery();

  const [companyId, setCompanyId] = useState('');
  const [secondDate, setSecondDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState('draft');
  const [number, setNumber] = useState<string | null>(null);
  const [paymentTermId, setPaymentTermId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [factorId, setFactorId] = useState('');

  useEffect(() => {
    const doc = existing.data;
    if (!doc) return;
    setCompanyId(doc.companyId);
    const dv = cfg.dateField ? doc[cfg.dateField] : null;
    setSecondDate(dv ? new Date(dv).toISOString().slice(0, 10) : '');
    setNotes(doc.notes ?? '');
    setStatus(doc.status);
    setNumber(doc.number ?? null);
    setLines(doc.lines.map((l: Record<string, unknown>) => ({ productId: (l.productId as string) ?? undefined, label: l.label as string, quantity: num(l.quantity), unitPriceHt: num(l.unitPriceHt), taxRatePct: num(l.taxRatePct) })));
    setPaymentTermId(doc.paymentTermId ?? '');
    setBankAccountId(doc.bankAccountId ?? '');
    setFactorId(doc.factorId ?? '');
  }, [existing.data, cfg.dateField]);

  const create = api.create.useMutation();
  const update = api.update.useMutation();
  const validate = api.validate.useMutation();
  const convert = cfg.key === 'quotes' ? api.convertToInvoice.useMutation() : null;
  const accept = cfg.key === 'quotes' ? api.accept.useMutation() : null;
  const refuse = cfg.key === 'quotes' ? api.refuse.useMutation() : null;
  const creditNote = cfg.key === 'invoices' ? api.createCreditNote.useMutation() : null;
  const postAcc = trpc.accounting.postSalesInvoice.useMutation();
  const posted = !!existing.data?.journalEntryId;
  const sendPdp = cfg.key === 'invoices' ? api.sendToPdp.useMutation() : null;
  const transmissions = cfg.key === 'invoices' ? api.transmissions.useQuery({ id }, { enabled: id !== 'new' && status !== 'draft' }) : null;
  const lastTx = transmissions?.data?.[0];
  const busy = create.isPending || update.isPending || validate.isPending;
  const readOnly = status !== 'draft';
  const pdf = usePdf(api);

  const company = companies.data?.find((c) => c.id === companyId);
  const factorForced = !!(company?.factorMandatory && company?.factorId);
  const onClient = (cid: string) => {
    setCompanyId(cid);
    const c = companies.data?.find((x) => x.id === cid);
    if (!c) return;
    setFactorId(c.factorId ?? '');
    setPaymentTermId(c.paymentTermId ?? (paymentTerms.data?.find((t) => t.isDefault)?.id ?? ''));
    setBankAccountId(bankAccounts.data?.find((b) => b.isDefault)?.id ?? '');
  };

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
    notes: notes || undefined,
    ...(cfg.dateField === 'dueDate' ? { dueDate: secondDate || undefined } : {}),
    ...(cfg.dateField === 'validUntil' ? { validUntil: secondDate || undefined } : {}),
    factorId: factorForced ? (company?.factorId ?? null) : (factorId || null),
    bankAccountId: bankAccountId || null,
    paymentTermId: paymentTermId || null,
    lines: lines.map((l, i) => ({ productId: l.productId, label: l.label || 'Ligne', quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: i })),
  });
  const persist = async () => {
    if (id === 'new') { const doc = await create.mutateAsync(payload()); setId(doc.id); return doc.id; }
    await update.mutateAsync({ id, ...payload() });
    return id;
  };
  const onSave = async () => { await persist(); uapi.list.invalidate(); if (id !== 'new') uapi.get.invalidate({ id }); };
  const onValidate = async () => { const theId = await persist(); await validate.mutateAsync({ id: theId }); uapi.list.invalidate(); onClose(); };

  const onConvert = async () => {
    await convert!.mutateAsync({ id });
    utils.invoices.list.invalidate();
    uapi.list.invalidate(); uapi.get.invalidate({ id });
    alert('Facture (brouillon) créée depuis ce devis — voir l’onglet Factures.');
    onClose();
  };
  const onAccept = async () => { await accept!.mutateAsync({ id }); uapi.list.invalidate(); uapi.get.invalidate({ id }); };
  const onRefuse = async () => { await refuse!.mutateAsync({ id }); uapi.list.invalidate(); uapi.get.invalidate({ id }); };
  const onCreditNote = async () => {
    await creditNote!.mutateAsync({ id });
    utils.creditNotes.list.invalidate();
    alert('Avoir (brouillon) créé depuis cette facture — voir l’onglet Avoirs.');
  };
  const onPost = async () => {
    const r = await postAcc.mutateAsync({ id });
    utils.invoices.get.invalidate({ id });
    utils.accounting.balance.invalidate(); utils.accounting.entries.list.invalidate();
    alert(r.alreadyPosted ? 'Facture déjà comptabilisée.' : 'Écriture comptable générée (journal des ventes) — voir Comptabilité ▸ Écritures.');
  };
  const onFacturx = async () => {
    const r = await uapi.facturx.fetch({ id });
    const url = URL.createObjectURL(new Blob([r.xml], { type: 'application/xml' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
  };
  const onSendPdp = async () => {
    const r = await sendPdp!.mutateAsync({ id });
    uapi.transmissions.invalidate({ id });
    alert(`Facture transmise (PDP « ${r.provider} ») — statut : ${r.status}, réf. ${r.providerRef}.`);
  };

  const err = create.error || update.error || validate.error || convert?.error || accept?.error || refuse?.error || creditNote?.error;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" onClick={onClose}><i className="bi bi-arrow-left" /></Button>
          <div>
            <h4 className="mb-1 fw-semibold">{number ? `${cfg.singular} ${number}` : id === 'new' ? cfg.newLabel : `${cfg.singular} (brouillon)`}</h4>
            <StatusBadge s={status} cfg={cfg} />
          </div>
        </div>
        <div className="d-flex gap-2">
          {id !== 'new' && (
            <Button variant="light" title="Télécharger le PDF" disabled={pdf.pending} onClick={() => pdf.download(id)}>
              <i className="bi bi-filetype-pdf me-1" />PDF
            </Button>
          )}
          {/* Devis émis : accepter / refuser / convertir */}
          {cfg.key === 'quotes' && status === 'sent' && (
            <>
              <Button variant="outline-success" onClick={onAccept}><i className="bi bi-check2 me-1" />Accepter</Button>
              <Button variant="outline-danger" onClick={onRefuse}><i className="bi bi-x me-1" />Refuser</Button>
            </>
          )}
          {cfg.key === 'quotes' && (status === 'sent' || status === 'accepted') && (
            <Button variant="primary" onClick={onConvert} disabled={convert!.isPending}><i className="bi bi-arrow-right-circle me-1" />Convertir en facture</Button>
          )}
          {/* Facture émise : comptabiliser + créer un avoir */}
          {cfg.key === 'invoices' && readOnly && status !== 'cancelled' && (
            <Button variant={posted ? 'success' : 'outline-primary'} onClick={onPost} disabled={postAcc.isPending || posted}>
              <i className={`bi ${posted ? 'bi-journal-check' : 'bi-journal-plus'} me-1`} />{posted ? 'Comptabilisée' : 'Comptabiliser'}
            </Button>
          )}
          {/* E-invoicing : Factur-X + envoi via PDP */}
          {cfg.key === 'invoices' && readOnly && status !== 'cancelled' && (
            <>
              <Button variant="light" onClick={onFacturx} title="Télécharger le XML Factur-X"><i className="bi bi-filetype-xml me-1" />Factur-X</Button>
              <Button variant={lastTx?.status === 'accepted' ? 'success' : 'outline-info'} onClick={onSendPdp} disabled={sendPdp.isPending}>
                <i className="bi bi-send me-1" />{lastTx ? `PDP : ${lastTx.status}` : 'Envoyer via PDP'}
              </Button>
            </>
          )}
          {cfg.key === 'invoices' && readOnly && status !== 'cancelled' && (
            <Button variant="outline-secondary" onClick={onCreditNote} disabled={creditNote!.isPending}><i className="bi bi-arrow-counterclockwise me-1" />Créer un avoir</Button>
          )}
          {!readOnly && (
            <>
              <Button variant="light" onClick={onSave} disabled={busy || !companyId}>{busy ? <Spinner size="sm" /> : <><i className="bi bi-save me-1" />Enregistrer</>}</Button>
              <Button onClick={onValidate} disabled={busy || !companyId || lines.length === 0}><i className="bi bi-check2-circle me-1" />{cfg.issueLabel}</Button>
            </>
          )}
        </div>
      </div>

      <Card className="mb-3">
        <Card.Body>
          <div className="row g-3">
            <div className="col-md-6">
              <Form.Label>Client</Form.Label>
              <Form.Select value={companyId} onChange={(e) => onClient(e.target.value)} disabled={readOnly}>
                <option value="">— Sélectionner —</option>
                {companies.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            {cfg.dateField && (
              <div className="col-md-3">
                <Form.Label>{cfg.dateLabel}</Form.Label>
                <Form.Control type="date" value={secondDate} onChange={(e) => setSecondDate(e.target.value)} disabled={readOnly} />
              </div>
            )}
          </div>
          {cfg.showBilling && (
            <div className="row g-3 mt-1">
              <div className="col-md-4">
                <Form.Label>Condition de paiement</Form.Label>
                <Form.Select value={paymentTermId} onChange={(e) => setPaymentTermId(e.target.value)} disabled={readOnly}>
                  <option value="">— Aucune —</option>
                  {(paymentTerms.data ?? []).filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.label} ({t.days} j)</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Compte bancaire</Form.Label>
                <Form.Select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} disabled={readOnly}>
                  <option value="">— Aucun —</option>
                  {(bankAccounts.data ?? []).filter((b) => b.isActive).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Affactureur (subrogation)</Form.Label>
                <Form.Select value={factorForced ? (company?.factorId ?? '') : factorId} onChange={(e) => setFactorId(e.target.value)} disabled={readOnly || factorForced}>
                  <option value="">— Aucun —</option>
                  {(factors.data ?? []).filter((f) => f.isActive).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Form.Select>
                {factorForced && <div className="text-secondary small mt-1"><i className="bi bi-lock me-1" />Imposé par le client</div>}
              </div>
            </div>
          )}
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
      {cfg.key === 'invoices' && (status === 'validated' || status === 'paid') && id !== 'new' && (
        <PaymentsCard invoiceId={id} totalTtc={totals.totalTtc} />
      )}
      {err && <div className="text-danger small mt-2">{err.message}</div>}
    </>
  );
}

/** Encaissements d'une facture : liste, ajout, reste dû. */
function PaymentsCard({ invoiceId, totalTtc }: { invoiceId: string; totalTtc: number }) {
  const utils = trpc.useUtils();
  const can = useCan();
  const list = trpc.payments.listForInvoice.useQuery({ invoiceId });
  const create = trpc.payments.create.useMutation();
  const remove = trpc.payments.remove.useMutation();
  const postPay = trpc.accounting.postPayment.useMutation();

  const paid = (list.data ?? []).reduce((s, p) => s + num(p.amount), 0);
  const remaining = Math.round((totalTtc - paid) * 100) / 100;

  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('virement');
  const [date, setDate] = useState('');
  const [reference, setReference] = useState('');
  useEffect(() => { setAmount(remaining > 0 ? remaining : 0); }, [list.data]); // amount réinitialisé au reste dû quand les règlements changent

  const refresh = () => {
    utils.payments.listForInvoice.invalidate({ invoiceId });
    utils.invoices.get.invalidate({ id: invoiceId });
    utils.invoices.list.invalidate();
    utils.payments.echeancier.invalidate();
  };
  const add = async () => {
    if (!(amount > 0)) return;
    await create.mutateAsync({ invoiceId, amount, method, date: date || undefined, reference: reference || undefined });
    setReference(''); refresh();
  };
  const del = async (id: string) => { await remove.mutateAsync({ id }); refresh(); };
  const post = async (id: string) => { await postPay.mutateAsync({ id }); utils.payments.listForInvoice.invalidate({ invoiceId }); utils.accounting.balance.invalidate(); utils.accounting.entries.list.invalidate(); };

  return (
    <Card className="mt-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0 fw-semibold"><i className="bi bi-cash-coin me-2" />Règlements</h6>
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
                    : can('create', 'Payment') && <Button variant="light" size="sm" className="me-1" title="Comptabiliser (journal banque)" onClick={() => post(p.id)}><i className="bi bi-journal-plus" /></Button>}
                  {!p.journalEntryId && can('delete', 'Payment') && <Button variant="light" size="sm" className="text-danger" onClick={() => del(p.id)}><i className="bi bi-trash" /></Button>}
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-2">Aucun règlement</td></tr>}
          </tbody>
        </Table>

        {can('create', 'Payment') && remaining > 0 && (
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
              <Button size="sm" className="w-100" onClick={add} disabled={create.isPending || !(amount > 0)}><i className="bi bi-plus-lg me-1" />Encaisser</Button>
            </div>
          </div>
        )}
        {create.error && <div className="text-danger small mt-2">{create.error.message}</div>}
      </Card.Body>
    </Card>
  );
}

export default function SalesDocs({ cfg }: { cfg: SalesCfg }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (trpc as any)[cfg.key];
  const list = api.list.useQuery();
  const can = useCan();
  const pdf = usePdf(api);
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  if (editing) return <Editor cfg={cfg} id={editing} onClose={() => setEditing(null)} />;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">{cfg.plural}</h4><p className="text-secondary mb-0">{cfg.subtitle}</p></div>
        {can('create', cfg.subject) && <Button onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />{cfg.newLabel}</Button>}
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Numéro</th><th>Client</th><th>Émission</th>{cfg.dateLabel && <th>{cfg.dateLabel}</th>}<th className="text-end">Total TTC</th><th>Statut</th><th className="text-end pe-3" /></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {list.data?.map((r: any) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r.id)}>
                  <td className="ps-3 fw-medium">{r.number ?? <span className="text-secondary fst-italic">brouillon</span>}</td>
                  <td>{r.company?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.issueDate)}</td>
                  {cfg.dateLabel && <td className="text-secondary">{dfmt(cfg.dateField ? r[cfg.dateField] : null)}</td>}
                  <td className="text-end fw-medium">{euro.format(r.totalTtc)}</td>
                  <td><StatusBadge s={r.status} cfg={cfg} /></td>
                  <td className="text-end pe-3" onClick={(e) => e.stopPropagation()}>
                    <Button variant="light" size="sm" className="me-1" title="Télécharger le PDF" disabled={pdf.pending} onClick={() => pdf.download(r.id)}>
                      <i className="bi bi-filetype-pdf" />
                    </Button>
                    <i className="bi bi-chevron-right text-secondary" />
                  </td>
                </tr>
              ))}
              {list.data?.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucun élément pour cette société</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}

// ── Configurations par type de pièce ──
const COMMON_STATUSES: Record<string, StatusStyle> = {
  draft: { label: 'Brouillon', bg: 'secondary-subtle', text: 'secondary' },
  cancelled: { label: 'Annulé', bg: 'danger-subtle', text: 'danger' },
};

export const QUOTE_CFG: SalesCfg = {
  key: 'quotes', subject: 'Quote', singular: 'Devis', plural: 'Devis', subtitle: 'Ventes & facturation',
  newLabel: 'Nouveau devis', issueLabel: 'Envoyer', dateLabel: 'Validité', dateField: 'validUntil', showBilling: true,
  statuses: {
    ...COMMON_STATUSES,
    sent: { label: 'Envoyé', bg: 'info-subtle', text: 'info' },
    accepted: { label: 'Accepté', bg: 'success-subtle', text: 'success' },
    refused: { label: 'Refusé', bg: 'danger-subtle', text: 'danger' },
    converted: { label: 'Converti', bg: 'primary-subtle', text: 'primary' },
  },
};

export const INVOICE_CFG: SalesCfg = {
  key: 'invoices', subject: 'Invoice', singular: 'Facture', plural: 'Factures', subtitle: 'Ventes & facturation',
  newLabel: 'Nouvelle facture', issueLabel: 'Valider', dateLabel: 'Échéance', dateField: 'dueDate', showBilling: true,
  statuses: {
    ...COMMON_STATUSES,
    validated: { label: 'Validée', bg: 'success-subtle', text: 'success' },
    paid: { label: 'Payée', bg: 'primary-subtle', text: 'primary' },
  },
};

export const CREDIT_NOTE_CFG: SalesCfg = {
  key: 'creditNotes', subject: 'CreditNote', singular: 'Avoir', plural: 'Avoirs', subtitle: 'Ventes & facturation',
  newLabel: 'Nouvel avoir', issueLabel: 'Valider', dateLabel: null, dateField: null, showBilling: false,
  statuses: {
    ...COMMON_STATUSES,
    validated: { label: 'Validé', bg: 'success-subtle', text: 'success' },
  },
};
