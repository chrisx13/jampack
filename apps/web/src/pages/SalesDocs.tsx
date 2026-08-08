import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { computeInvoiceTotals, resolvePrice, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@jampack/domain';
import { useToast } from '../components/Toast';

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
  const toast = useToast();
  const can = useCan();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (trpc as any)[cfg.key];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uapi = (utils as any)[cfg.key];
  const [id, setId] = useState<string | 'new'>(initialId);
  const companies = trpc.crm.companies.list.useQuery();
  const products = trpc.catalog.products.list.useQuery();
  const priceRules = trpc.catalog.priceRules.list.useQuery();
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
  const [vatReverseCharge, setVatReverseCharge] = useState(false);
  const [customerReference, setCustomerReference] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState('');

  useEffect(() => {
    const doc = existing.data;
    if (!doc) return;
    setCompanyId(doc.companyId);
    const dv = cfg.dateField ? doc[cfg.dateField] : null;
    setSecondDate(dv ? new Date(dv).toISOString().slice(0, 10) : '');
    setNotes(doc.notes ?? '');
    setVatReverseCharge(!!doc.vatReverseCharge);
    setCustomerReference(doc.customerReference ?? '');
    setPaymentUrl(doc.paymentUrl ?? '');
    setDiscountType((doc.discountType as 'none' | 'percent' | 'amount') ?? 'none');
    setDiscountValue(doc.discountValue != null && num(doc.discountValue) > 0 ? String(num(doc.discountValue)) : '');
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
    const termId = c.paymentTermId ?? (paymentTerms.data?.find((t) => t.isDefault)?.id ?? '');
    setPaymentTermId(termId);
    setBankAccountId(bankAccounts.data?.find((b) => b.isDefault)?.id ?? '');
    // Simplicité : pré-remplit l'échéance de facture (aujourd'hui + délai de la condition de règlement)
    // si elle n'a pas été saisie manuellement. L'utilisateur reste libre de la corriger.
    if (cfg.dateField === 'dueDate' && !secondDate) {
      const days = paymentTerms.data?.find((t) => t.id === termId)?.days;
      if (days != null) {
        const d = new Date(); d.setDate(d.getDate() + days);
        setSecondDate(d.toISOString().slice(0, 10));
      }
    }
  };

  const totals = useMemo(
    () => computeInvoiceTotals(lines, { discountType, discountValue: num(discountValue) || 0 }),
    [lines, discountType, discountValue],
  );
  // Grille tarifaire : résout le PU HT d'un article selon le client et la quantité.
  const priceFor = (productId: string, quantity: number, base: number) => {
    const rules = (priceRules.data ?? []).filter((r) => r.productId === productId).map((r) => ({ companyId: r.companyId, minQuantity: num(r.minQuantity), unitPriceHt: num(r.unitPriceHt) }));
    return resolvePrice(rules, { companyId: companyId || null, quantity }, base);
  };
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => {
    if (k !== i) return l;
    const next = { ...l, ...patch };
    // Recalcule le prix quand la quantité change sur une ligne rattachée à un article.
    if (patch.quantity !== undefined && next.productId) {
      const p = products.data?.find((x) => x.id === next.productId);
      if (p) next.unitPriceHt = priceFor(next.productId, num(next.quantity), num(p.priceHt));
    }
    return next;
  }));
  const addLine = () => setLines((ls) => [...ls, { label: '', quantity: 1, unitPriceHt: 0, taxRatePct: num(taxRates.data?.find((t) => t.isDefault)?.rate) || 20 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, k) => k !== i));
  const onPickProduct = (i: number, productId: string) => {
    const p = products.data?.find((x) => x.id === productId);
    if (!p) { setLine(i, { productId: undefined }); return; }
    const qty = lines[i]?.quantity ?? 1;
    setLine(i, { productId, label: p.name, unitPriceHt: priceFor(productId, num(qty), num(p.priceHt)), taxRatePct: num(p.taxRate?.rate) || 0 });
  };

  const payload = () => ({
    companyId,
    notes: notes || undefined,
    customerReference: customerReference || null,
    ...(cfg.dateField === 'dueDate' ? { dueDate: secondDate || undefined } : {}),
    ...(cfg.dateField === 'validUntil' ? { validUntil: secondDate || undefined } : {}),
    factorId: factorForced ? (company?.factorId ?? null) : (factorId || null),
    bankAccountId: bankAccountId || null,
    paymentTermId: paymentTermId || null,
    ...(cfg.key === 'invoices' ? { vatReverseCharge, paymentUrl: paymentUrl.trim() || null } : {}),
    discountType,
    discountValue: discountType === 'none' ? 0 : (num(discountValue) || 0),
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
    toast('Facture (brouillon) créée depuis ce devis — voir l’onglet Factures.');
    onClose();
  };
  const deposit = cfg.key === 'quotes' ? (trpc as unknown as { quotes: { createDepositInvoice: { useMutation: () => { mutateAsync: (v: { id: string; pct: number }) => Promise<{ id: string }>; isPending: boolean } } } }).quotes.createDepositInvoice.useMutation() : null;
  const onDeposit = async () => {
    const raw = window.prompt('Pourcentage d’acompte à facturer (%) :', '30');
    if (raw == null) return;
    const pct = Number(raw.replace(',', '.'));
    if (!(pct > 0 && pct <= 100)) { toast('Pourcentage invalide (0 à 100).', 'danger'); return; }
    await deposit!.mutateAsync({ id, pct });
    utils.invoices.list.invalidate();
    toast(`Facture d’acompte (${pct} %) créée en brouillon — voir l’onglet Factures. Elle sera déduite à la conversion en facture de solde.`);
  };
  const publicLink = cfg.key === 'quotes' ? (trpc as unknown as { quotes: { publicLink: { useMutation: () => { mutateAsync: (v: { id: string }) => Promise<{ path: string }>; isPending: boolean } } } }).quotes.publicLink.useMutation() : null;
  const onPublicLink = async () => {
    const r = await publicLink!.mutateAsync({ id });
    const url = window.location.origin + r.path;
    try { await navigator.clipboard.writeText(url); toast(`Lien de signature copié :\n${url}\n\nEnvoyez-le au client pour qu'il accepte le devis en ligne.`); }
    catch { window.prompt('Lien de signature du devis (copiez-le) :', url); }
  };
  const onAccept = async () => { await accept!.mutateAsync({ id }); uapi.list.invalidate(); uapi.get.invalidate({ id }); };
  const onRefuse = async () => { await refuse!.mutateAsync({ id }); uapi.list.invalidate(); uapi.get.invalidate({ id }); };
  const onCreditNote = async () => {
    await creditNote!.mutateAsync({ id });
    utils.creditNotes.list.invalidate();
    toast('Avoir (brouillon) créé depuis cette facture — voir l’onglet Avoirs.');
  };
  const onPost = async () => {
    const r = await postAcc.mutateAsync({ id });
    utils.invoices.get.invalidate({ id });
    utils.accounting.balance.invalidate(); utils.accounting.entries.list.invalidate();
    toast(r.alreadyPosted ? 'Facture déjà comptabilisée.' : 'Écriture comptable générée (journal des ventes) — voir Comptabilité ▸ Écritures.');
  };
  const onFacturx = async () => {
    const r = await uapi.facturx.fetch({ id });
    const url = URL.createObjectURL(new Blob([r.xml], { type: 'application/xml' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
  };
  const onSendPdp = async () => {
    const r = await sendPdp!.mutateAsync({ id });
    uapi.transmissions.invalidate({ id });
    toast(`Facture transmise (PDP « ${r.provider} ») — statut : ${r.status}, réf. ${r.providerRef}.`);
  };
  const delivery = cfg.key === 'invoices' ? api.deliveryNote.useMutation() : null;
  const onDelivery = async () => {
    const r = await delivery!.mutateAsync({ id });
    const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
    uapi.get.invalidate({ id });
  };
  const duplicate = api.duplicate.useMutation();
  const onDuplicate = async () => {
    const copy = await duplicate.mutateAsync({ id });
    uapi.list.invalidate();
    setId(copy.id); // bascule sur le nouveau brouillon
  };

  const err = create.error || update.error || validate.error || convert?.error || accept?.error || refuse?.error || creditNote?.error || duplicate.error;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" aria-label="Retour" onClick={onClose}><i className="bi bi-arrow-left" /></Button>
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
          {id !== 'new' && can('create', cfg.subject) && (
            <Button variant="light" title="Dupliquer en brouillon" disabled={duplicate.isPending} onClick={onDuplicate}>
              <i className="bi bi-files me-1" />Dupliquer
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
            <>
              <Button variant="light" onClick={onPublicLink} disabled={publicLink!.isPending} title="Lien de signature en ligne"><i className="bi bi-link-45deg me-1" />Lien de signature</Button>
              <Button variant="outline-primary" onClick={onDeposit} disabled={deposit!.isPending}><i className="bi bi-cash-coin me-1" />Facture d'acompte</Button>
              <Button variant="primary" onClick={onConvert} disabled={convert!.isPending}><i className="bi bi-arrow-right-circle me-1" />Convertir en facture</Button>
            </>
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
            <Button variant="light" onClick={onDelivery} disabled={delivery!.isPending} title="Bon de livraison (PDF)"><i className="bi bi-truck me-1" />Bon de livraison</Button>
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
            <div className="col-md-3">
              <Form.Label>Réf. commande client</Form.Label>
              <Form.Control value={customerReference} maxLength={80} placeholder="Bon de commande…" onChange={(e) => setCustomerReference(e.target.value)} disabled={readOnly} />
            </div>
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
              {cfg.key === 'invoices' && (
                <div className="col-md-12">
                  <Form.Label>Lien de paiement en ligne <span className="text-secondary fw-normal">(optionnel)</span></Form.Label>
                  <Form.Control type="url" placeholder="https://… (lien fourni par votre prestataire de paiement)" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} disabled={readOnly} />
                  <div className="text-secondary small mt-1">Affiché comme lien « Régler en ligne » sur le PDF. JAMPACK ne traite aucun paiement.</div>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body className="p-0">
          <Table className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3" style={{ width: 200 }}>Article</th><th scope="col">Désignation</th><th scope="col" className="text-end" style={{ width: 90 }}>Qté</th><th scope="col" className="text-end" style={{ width: 120 }}>PU HT</th><th scope="col" className="text-end" style={{ width: 110 }}>TVA</th><th scope="col" className="text-end" style={{ width: 120 }}>Total HT</th><th scope="col" style={{ width: 50 }}><span className="visually-hidden">Retirer</span></th></tr>
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
          {cfg.key === 'invoices' && (
            <Form.Check
              type="switch" id="vatReverseCharge" className="mt-3"
              label="Autoliquidation de TVA (TVA due par le preneur — art. 283-2 CGI)"
              checked={vatReverseCharge} disabled={readOnly}
              onChange={(e) => setVatReverseCharge(e.target.checked)}
            />
          )}
        </div>
        <div className="col-md-5">
          <Card>
            <Card.Body>
              {!readOnly && (
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Form.Select size="sm" style={{ width: 130 }} value={discountType} onChange={(e) => setDiscountType(e.target.value as 'none' | 'percent' | 'amount')}>
                    <option value="none">Sans remise</option>
                    <option value="percent">Remise %</option>
                    <option value="amount">Remise €</option>
                  </Form.Select>
                  {discountType !== 'none' && (
                    <Form.Control size="sm" type="number" min={0} step="0.01" style={{ width: 110 }} placeholder={discountType === 'percent' ? '%' : '€ HT'} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                  )}
                </div>
              )}
              {totals.discountHt > 0 && (
                <>
                  <div className="d-flex justify-content-between mb-1"><span className="text-secondary">Sous-total HT</span><span>{euro.format(totals.grossHt)}</span></div>
                  <div className="d-flex justify-content-between mb-1 text-success"><span>Remise{discountType === 'percent' ? ` (${num(discountValue)} %)` : ''}</span><span>− {euro.format(totals.discountHt)}</span></div>
                </>
              )}
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Filtrage local (recherche numéro/client + statut) — instantané, sans requête serveur.
  const all = (list.data ?? []) as { id: string; number?: string | null; status: string; company?: { name?: string } }[];
  const q = search.trim().toLowerCase();
  const rows = all.filter((r) =>
    (!statusFilter || r.status === statusFilter) &&
    (!q || (r.number ?? '').toLowerCase().includes(q) || (r.company?.name ?? '').toLowerCase().includes(q))
  );
  // La barre de filtres n'apparaît qu'au-delà de quelques pièces (évite le superflu sur un écran quasi vide).
  const showFilters = all.length > 5;

  if (editing) return <Editor cfg={cfg} id={editing} onClose={() => setEditing(null)} />;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">{cfg.plural}</h4><p className="text-secondary mb-0">{cfg.subtitle}</p></div>
        {can('create', cfg.subject) && <Button onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />{cfg.newLabel}</Button>}
      </div>

      {showFilters && (
        <div className="d-flex flex-wrap gap-2 mb-3" style={{ maxWidth: 560 }}>
          <div className="position-relative flex-grow-1">
            <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <Form.Control aria-label="Rechercher une pièce" size="sm" className="ps-4" placeholder="Rechercher un numéro ou un client…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Form.Select aria-label="Filtrer par statut" size="sm" style={{ width: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries(cfg.statuses).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Form.Select>
        </div>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Numéro</th><th scope="col">Client</th><th scope="col">Émission</th>{cfg.dateLabel && <th scope="col">{cfg.dateLabel}</th>}<th scope="col" className="text-end">Total TTC</th><th scope="col">Statut</th><th scope="col" className="text-end pe-3"><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {rows.map((r: any) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r.id)}>
                  <td className="ps-3 fw-medium">
                    {/* Contrôle focalisable au clavier pour ouvrir la pièce (RGAA 12 — la ligne reste cliquable à la souris). */}
                    <button type="button" className="btn btn-link p-0 text-decoration-none text-body fw-medium" onClick={(e) => { e.stopPropagation(); setEditing(r.id); }}>
                      {r.number ?? <span className="text-secondary fst-italic">brouillon</span>}
                      <span className="visually-hidden"> — ouvrir</span>
                    </button>
                  </td>
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
              {list.isSuccess && all.length === 0 && (
                <tr><td colSpan={7} className="text-center text-secondary py-5">
                  <div className="mb-2"><i className="bi bi-inbox fs-3 opacity-50" aria-hidden="true" /></div>
                  <div className="mb-3">Aucun{cfg.plural.endsWith('s') ? '' : 'e'} {cfg.plural.toLowerCase()} pour l'instant.</div>
                  {can('create', cfg.subject) && <Button size="sm" onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" aria-hidden="true" />{cfg.newLabel}</Button>}
                </td></tr>
              )}
              {list.isSuccess && all.length > 0 && rows.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucun résultat pour ce filtre</td></tr>}
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
