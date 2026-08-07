import { useState } from 'react';
import { Modal, Button, Spinner, Badge, Alert, Form } from 'react-bootstrap';
import { trpc } from '../trpc';
// pdf.js est volumineux : chargé à la demande (import dynamique) pour ne pas alourdir le démarrage.

// Scanner de document (facture fournisseur / note de frais).
// Niveau 1 GRATUIT : extraction locale (Factur-X + texte PDF) → règles FR côté serveur.
// Niveau 2 (option) : « Affiner avec l'IA » (Claude), 1 crédit, si activé et crédité.
// Aucune pièce n'est créée ici : on pré-remplit un brouillon que l'utilisateur valide.

type Field = { value: string | number; confidence: 'high' | 'medium' | 'low'; source: string; valid?: boolean };
type Result = {
  source: string;
  fields: Record<string, Field | undefined>;
  summary: string;
  needsReview: string[];
  warnings: string[];
};
export interface ExpenseDraft { date?: string; category: string; description: string; amountHt?: number; taxRatePct: number }
export interface SupplierInvoiceDraft { supplierName?: string; siren?: string; tvaNumber?: string; iban?: string; invoiceNumber?: string; date?: string; totalHt?: number; totalTva?: number; totalTtc?: number }
type Analyze = { result: Result; expenseDraft: ExpenseDraft; supplierInvoiceDraft: SupplierInvoiceDraft };

/** Charge utile transmise à l'appelant lors du « Pré-remplir » : les deux brouillons + le justificatif. */
export interface ScanResult {
  result: Result;
  expenseDraft: ExpenseDraft;
  supplierInvoiceDraft: SupplierInvoiceDraft;
  receipt?: string; // data-URL image (photo/justificatif) le cas échéant
}

const CONF: Record<string, { bg: string; label: string }> = {
  high: { bg: 'success', label: 'fiable' },
  medium: { bg: 'warning', label: 'à confirmer' },
  low: { bg: 'secondary', label: 'incertain' },
};
const LABELS: Record<string, string> = {
  supplierName: 'Fournisseur', siren: 'SIREN', siret: 'SIRET', tvaNumber: 'N° TVA', iban: 'IBAN',
  invoiceNumber: 'N° pièce', date: 'Date', totalHt: 'Total HT', totalTva: 'TVA', totalTtc: 'Total TTC', taxRatePct: 'Taux TVA',
};

export default function DocumentScanner({ show, onClose, onPrefill }: { show: boolean; onClose: () => void; onPrefill: (p: ScanResult) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | undefined>();
  const [facturxXml, setFacturxXml] = useState<string | undefined>();
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [data, setData] = useState<Analyze | null>(null);

  const aiStatus = trpc.documents.aiStatus.useQuery(undefined, { enabled: show });
  const analyze = trpc.documents.analyze.useMutation();
  const aiAnalyze = trpc.documents.aiAnalyze.useMutation();

  const reset = () => { setError(null); setData(null); setText(undefined); setFacturxXml(undefined); setImageDataUrl(undefined); setFileName(null); };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    reset();
    setFileName(file.name);
    setBusy(true);
    try {
      const { extractPdf, imageToDataUrl } = await import('../lib/pdf');
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const ex = await extractPdf(file);
        setText(ex.text); setFacturxXml(ex.facturxXml);
        const res = (await analyze.mutateAsync({ text: ex.text, facturxXml: ex.facturxXml })) as Analyze;
        setData(res);
      } else if (file.type.startsWith('image/')) {
        const url = await imageToDataUrl(file);
        setImageDataUrl(url);
        // Sans texte local exploitable sur une photo : proposer l'IA (le socle gratuit reste possible mais pauvre).
      } else {
        setError('Format non pris en charge. Fournir un PDF ou une image.');
      }
    } catch (e) {
      setError(`Lecture impossible : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const runAi = async () => {
    setBusy(true); setError(null);
    try {
      const res = (await aiAnalyze.mutateAsync({ text, facturxXml, imageDataUrl })) as Analyze & { balance: number };
      setData(res);
      await aiStatus.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const prefill = () => {
    if (data) {
      onPrefill({ result: data.result, expenseDraft: data.expenseDraft, supplierInvoiceDraft: data.supplierInvoiceDraft, receipt: imageDataUrl });
    } else if (imageDataUrl) {
      // Photo sans extraction (IA indisponible) : joindre au moins le justificatif + date du jour.
      const today = new Date().toISOString().slice(0, 10);
      onPrefill({
        result: { source: 'none', fields: {}, summary: '', needsReview: [], warnings: [] },
        expenseDraft: { date: today, category: 'autre', description: '', amountHt: undefined, taxRatePct: 20 },
        supplierInvoiceDraft: {},
        receipt: imageDataUrl,
      });
    } else return;
    close();
  };

  const fields = data?.result.fields ?? {};
  const aiEnabled = aiStatus.data?.enabled;
  const balance = aiStatus.data?.balance ?? 0;

  return (
    <Modal show={show} onHide={close} size="lg" centered>
      <Modal.Header closeButton><Modal.Title className="fs-5"><i className="bi bi-magic me-2" />Scanner un document</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-secondary small mb-3">
          Dépôt d'un <strong>PDF</strong> (facture) ou d'une <strong>photo</strong>. Extraction <strong>locale et gratuite</strong>
          (Factur-X + texte PDF, règles françaises). Une <strong>validation</strong> reste requise avant création.
        </p>

        <Form.Group className="mb-3">
          <Form.Control type="file" accept="application/pdf,image/*" disabled={busy}
            onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onFile(f); }} />
          {fileName && <Form.Text className="text-secondary"><i className="bi bi-paperclip me-1" />{fileName}</Form.Text>}
        </Form.Group>

        {busy && <div className="text-center py-3"><Spinner size="sm" className="me-2" />Analyse…</div>}
        {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

        {imageDataUrl && !data && (
          <div className="mb-3 text-center">
            <img src={imageDataUrl} alt="aperçu" style={{ maxHeight: 180, maxWidth: '100%' }} className="rounded border" />
            {aiEnabled && balance > 0
              ? <p className="text-secondary small mt-2 mb-0">Photo : lancez <strong>« Affiner avec l'IA »</strong> pour extraire les champs, ou <strong>« Pré-remplir »</strong> pour joindre la photo en justificatif.</p>
              : <Alert variant="warning" className="py-2 small mt-2 mb-0"><i className="bi bi-exclamation-triangle me-1" />Reconnaissance IA indisponible ({aiEnabled ? 'crédits épuisés' : 'désactivée'}). La photo sera <strong>jointe en justificatif</strong> ; complétez les champs à la main via « Pré-remplir ».</Alert>}
          </div>
        )}

        {data && (
          <>
            <div className="d-flex align-items-center gap-2 mb-2">
              <Badge bg="light" text="dark" className="border">source : {data.result.source}</Badge>
              <span className="fw-medium">{data.result.summary}</span>
            </div>
            {data.result.warnings.map((w, i) => <Alert key={i} variant="warning" className="py-2 small mb-2"><i className="bi bi-exclamation-triangle me-1" />{w}</Alert>)}
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-2">
                <tbody>
                  {Object.entries(LABELS).map(([k, label]) => {
                    const f = fields[k];
                    if (!f) return null;
                    const c = CONF[f.confidence];
                    return (
                      <tr key={k}>
                        <td className="text-secondary" style={{ width: 130 }}>{label}</td>
                        <td className="fw-medium">{String(f.value)}</td>
                        <td style={{ width: 120 }} className="text-end">
                          <Badge bg={f.valid === false ? 'danger' : c.bg} className="fw-normal">{f.valid === false ? 'non valide' : c.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.result.needsReview.length > 0 && (
              <p className="small text-secondary mb-0"><i className="bi bi-info-circle me-1" />À vérifier : {data.result.needsReview.map((k) => LABELS[k] ?? k).join(', ')}.</p>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <div className="small text-secondary">
          {aiEnabled
            ? <>Enrichissement IA (Claude) : <strong>{balance}</strong> crédit(s){aiStatus.data?.model ? ` · ${aiStatus.data.model}` : ''}</>
            : <>Enrichissement IA désactivé — extraction locale seulement</>}
        </div>
        <div className="d-flex gap-2">
          {aiEnabled && (text || facturxXml || imageDataUrl) && (
            <Button variant="outline-primary" disabled={busy || balance <= 0} onClick={runAi} title={balance <= 0 ? 'Crédits épuisés' : 'Envoie le document à Claude'}>
              <i className="bi bi-magic me-1" />Affiner avec l'IA (1 crédit)
            </Button>
          )}
          <Button variant="primary" disabled={!data && !imageDataUrl} onClick={prefill}><i className="bi bi-check2 me-1" />Pré-remplir</Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
