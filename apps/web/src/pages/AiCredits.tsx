import { useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge, Alert } from 'react-bootstrap';
import { trpc } from '../trpc';

// Administration des crédits d'IA (niveau 2 — enrichissement Claude de la reconnaissance de documents).
// Fournisseur unique : Claude (Anthropic). Hors périmètre paiement : la recharge est une décision d'admin.

const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleString('fr-FR') : '—');
const REASON: Record<string, string> = { topup: 'Recharge', analyze: 'Analyse (créditée)', free: 'Analyse (franchise gratuite)', adjust: 'Ajustement' };

export default function AiCredits() {
  const utils = trpc.useUtils();
  const status = trpc.documents.aiStatus.useQuery();
  const history = trpc.documents.creditsHistory.useQuery();
  const spend = trpc.documents.spendSummary.useQuery();
  const topup = trpc.documents.creditsTopup.useMutation({
    onSuccess: () => { utils.documents.aiStatus.invalidate(); utils.documents.creditsHistory.invalidate(); setAmount(''); },
  });

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const n = Number(amount);
  const rows = history.data?.rows ?? [];
  const balance = status.data?.balance ?? history.data?.balance ?? 0;

  return (
    <>
      <div className="mb-4">
        <h4 className="mb-1 fw-semibold">Crédits IA</h4>
        <p className="text-secondary mb-0">Enrichissement par <strong>Claude</strong>. Chaque utilisateur dispose d'une <strong>franchise gratuite mensuelle</strong> (incluse dans l'abonnement) ; au-delà, 1 crédit par analyse.</p>
      </div>

      {status.data && !status.data.enabled && (
        <Alert variant="secondary" className="d-flex align-items-start gap-2">
          <i className="bi bi-info-circle mt-1" />
          <div>
            <strong>Enrichissement IA désactivé.</strong> Le niveau gratuit (Factur-X + texte PDF + règles FR) reste
            actif. Pour activer l'IA, définir <code>ANTHROPIC_API_KEY</code> sur le service API (voir runbook).
          </div>
        </Alert>
      )}

      <div className="row g-3">
        <div className="col-md-4">
          <Card className="h-100"><Card.Body className="text-center d-flex flex-column justify-content-center">
            <div className="text-secondary small">Solde de crédits</div>
            <div className="display-6 fw-semibold">{balance}</div>
            <div className="mt-2">
              {status.data?.enabled
                ? <Badge bg="success-subtle" text="success" className="fw-normal">IA active{status.data.model ? ` · ${status.data.model}` : ''}</Badge>
                : <Badge bg="secondary-subtle" text="secondary" className="fw-normal">IA inactive</Badge>}
            </div>
          </Card.Body></Card>
        </div>

        <div className="col-md-8">
          <Card className="h-100"><Card.Body>
            <h6 className="fw-semibold mb-3">Recharger</h6>
            <div className="row g-2 align-items-end">
              <Form.Group className="col-sm-4"><Form.Label className="small">Nombre de crédits</Form.Label>
                <Form.Control type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ex. 100" />
              </Form.Group>
              <Form.Group className="col-sm-5"><Form.Label className="small">Note (facultatif)</Form.Label>
                <Form.Control value={note} onChange={(e) => setNote(e.target.value)} placeholder="motif de la dotation…" maxLength={200} />
              </Form.Group>
              <div className="col-sm-3 d-grid">
                <Button disabled={!(n >= 1) || topup.isPending} onClick={() => topup.mutate({ amount: Math.floor(n), note: note.trim() || undefined })}>
                  {topup.isPending ? <Spinner size="sm" /> : <><i className="bi bi-plus-circle me-1" />Créditer</>}
                </Button>
              </div>
            </div>
            <p className="text-secondary small mb-0 mt-2">Hors périmètre paiement : la recharge est une décision d'administration (traçée ci-dessous).</p>
          </Card.Body></Card>
        </div>
      </div>

      {spend.data && (
        <Card className="mt-3"><Card.Body>
          <h6 className="fw-semibold mb-2"><i className="bi bi-graph-up me-2" />Consommation du mois (coût fournisseur)</h6>
          <div className="row g-2 text-center small">
            <div className="col-6 col-md-3"><div className="border rounded-3 p-2"><div className="fw-semibold fs-6">{spend.data.freeAnalyses}</div><div className="text-secondary">gratuites (franchise)</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded-3 p-2"><div className="fw-semibold fs-6">{spend.data.paidAnalyses}</div><div className="text-secondary">payantes (crédits)</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded-3 p-2"><div className="fw-semibold fs-6">{(spend.data.inputTokens + spend.data.outputTokens).toLocaleString('fr-FR')}</div><div className="text-secondary">tokens (in+out)</div></div></div>
            <div className="col-6 col-md-3"><div className="border rounded-3 p-2"><div className="fw-semibold fs-6">{spend.data.cacheReadTokens.toLocaleString('fr-FR')}</div><div className="text-secondary">tokens en cache</div></div></div>
          </div>
          <p className="text-secondary small mb-0 mt-2">Depuis le 1er du mois{spend.data.models.length ? ` · modèle(s) : ${spend.data.models.join(', ')}` : ''}. À réconcilier avec le coût Anthropic (Console) et le revenu des crédits vendus.</p>
        </Card.Body></Card>
      )}

      <Card className="mt-3"><Card.Body className="p-0">
        <div className="p-3 pb-2"><h6 className="fw-semibold mb-0">Historique (50 derniers mouvements)</h6></div>
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th className="ps-3">Date</th><th>Opération</th><th>Référence</th><th className="text-end pe-3">Crédits</th></tr></thead>
          <tbody>
            {history.isLoading && <tr><td colSpan={4} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="ps-3 text-secondary">{dfmt(r.createdAt)}</td>
                <td>{REASON[r.reason] ?? r.reason}</td>
                <td className="text-secondary">{r.documentRef ?? '—'}</td>
                <td className={`text-end pe-3 fw-medium ${r.delta < 0 ? 'text-danger' : 'text-success'}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
              </tr>
            ))}
            {history.isSuccess && rows.length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-4">Aucun mouvement</td></tr>}
          </tbody>
        </Table>
      </Card.Body></Card>
    </>
  );
}
