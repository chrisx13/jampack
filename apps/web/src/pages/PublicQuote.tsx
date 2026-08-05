import { useEffect, useState } from 'react';
import { Card, Table, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

/** Page publique (sans authentification) de consultation et de signature en ligne d'un devis. */
export default function PublicQuote({ token }: { token: string }) {
  const q = trpc.publicQuote.get.useQuery({ token }, { retry: false });
  const utils = trpc.useUtils();
  const accept = trpc.publicQuote.accept.useMutation({ onSuccess: () => utils.publicQuote.get.invalidate({ token }) });
  const decline = trpc.publicQuote.decline.useMutation({ onSuccess: () => utils.publicQuote.get.invalidate({ token }) });
  const [name, setName] = useState('');
  // RGAA 8.5/8.6 : titre de page pertinent, mis à jour selon le devis.
  useEffect(() => {
    document.title = q.data?.number ? `Devis ${q.data.number} — ${q.data.societe?.name ?? 'JAMPACK'}` : 'Devis — JAMPACK';
  }, [q.data]);

  return (
    <main style={{ minHeight: '100vh', background: '#f1f5f9', padding: '32px 16px' }} lang="fr">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ height: 5, borderRadius: 4, background: 'linear-gradient(90deg, #3E3A52, #6366F1, #0EA5E9)', marginBottom: 20 }} aria-hidden="true" />
        {q.isLoading && <div className="text-center py-5" role="status"><Spinner /><span className="visually-hidden">Chargement du devis…</span></div>}
        {q.isError && <Alert variant="danger">Devis introuvable ou lien invalide.</Alert>}
        {q.data && (
          <Card className="shadow-sm">
            <Card.Body className="p-4">
              <h1 className="visually-hidden">Devis {q.data.number ?? ''} de {q.data.societe?.name ?? ''}</h1>
              <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
                <div>
                  <div className="fw-bold fs-5">{q.data.societe?.name}</div>
                  <div className="text-secondary small">
                    {[q.data.societe?.addressLine1, [q.data.societe?.postalCode, q.data.societe?.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-secondary small">{[q.data.societe?.siret && `SIRET ${q.data.societe.siret}`, q.data.societe?.tvaNumber && `TVA ${q.data.societe.tvaNumber}`].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="text-end">
                  <p className="mb-1 fw-semibold fs-4" style={{ color: '#3E3A52' }} aria-hidden="true">DEVIS</p>
                  <div className="fw-medium">{q.data.number ?? '—'}</div>
                  <div className="text-secondary small">Émis le {dfmt(q.data.issueDate)}</div>
                  {q.data.validUntil && <div className="text-secondary small">Valable jusqu’au {dfmt(q.data.validUntil)}</div>}
                </div>
              </div>

              {q.data.client && <div className="text-secondary small mb-3">À l’attention de <strong>{q.data.client}</strong></div>}

              <Table className="align-middle mb-3">
                <caption className="visually-hidden">Détail des lignes du devis</caption>
                <thead className="text-secondary small"><tr><th scope="col">Désignation</th><th scope="col" className="text-end">Qté</th><th scope="col" className="text-end">PU HT</th><th scope="col" className="text-end">TVA</th><th scope="col" className="text-end">Total HT</th></tr></thead>
                <tbody>
                  {q.data.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.label}</td>
                      <td className="text-end">{l.quantity.toLocaleString('fr-FR')}</td>
                      <td className="text-end">{euro.format(l.unitPriceHt)}</td>
                      <td className="text-end">{l.taxRatePct} %</td>
                      <td className="text-end">{euro.format(l.quantity * l.unitPriceHt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="d-flex justify-content-end">
                <div style={{ minWidth: 240 }}>
                  {q.data.discountHt > 0 && <div className="d-flex justify-content-between mb-1"><span className="text-secondary">Remise</span><span>− {euro.format(q.data.discountHt)}</span></div>}
                  <div className="d-flex justify-content-between mb-1"><span className="text-secondary">Total HT</span><span>{euro.format(q.data.totalHt)}</span></div>
                  <div className="d-flex justify-content-between mb-1"><span className="text-secondary">TVA</span><span>{euro.format(q.data.totalTva)}</span></div>
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between fw-semibold fs-5"><span>Total TTC</span><span>{euro.format(q.data.totalTtc)}</span></div>
                </div>
              </div>

              <hr className="my-4" />

              {q.data.status === 'accepted' ? (
                <Alert variant="success" className="mb-0" role="status">
                  <i className="bi bi-check-circle me-2" aria-hidden="true" />Devis <strong>accepté</strong> le {dfmt(q.data.acceptedAt)}{q.data.acceptedByName ? ` par ${q.data.acceptedByName}` : ''}.
                </Alert>
              ) : q.data.status === 'refused' ? (
                <Alert variant="secondary" className="mb-0" role="status">
                  <i className="bi bi-x-circle me-2" aria-hidden="true" />Devis <strong>refusé</strong> le {dfmt(q.data.acceptedAt)}{q.data.acceptedByName ? ` par ${q.data.acceptedByName}` : ''}.
                </Alert>
              ) : q.data.status === 'sent' ? (
                <div>
                  <h2 className="fw-semibold mb-2 fs-5">Répondre à ce devis</h2>
                  <p className="text-secondary small">En saisissant votre nom et en validant, vous acceptez (« Bon pour accord ») ou refusez ce devis. L’horodatage et votre adresse IP sont enregistrés comme preuve.</p>
                  {(accept.isError || decline.isError) && <Alert variant="danger" className="py-2" role="alert">{(accept.error || decline.error)?.message}</Alert>}
                  <Form.Group className="mb-2" style={{ maxWidth: 360 }}>
                    <Form.Label htmlFor="signer-name">Vos nom et prénom</Form.Label>
                    <Form.Control id="signer-name" autoComplete="name" placeholder="Ex. Marie Dupont" value={name} onChange={(e) => setName(e.target.value)} />
                  </Form.Group>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button variant="success" disabled={name.trim().length < 2 || accept.isPending} onClick={() => accept.mutate({ token, signerName: name.trim() })}>
                      {accept.isPending ? <Spinner size="sm" /> : <><i className="bi bi-check2-circle me-1" aria-hidden="true" />Accepter le devis</>}
                    </Button>
                    <Button variant="outline-danger" disabled={name.trim().length < 2 || decline.isPending} onClick={() => { if (confirm('Confirmer le refus de ce devis ?')) decline.mutate({ token, signerName: name.trim() }); }}>
                      {decline.isPending ? <Spinner size="sm" /> : <><i className="bi bi-x me-1" aria-hidden="true" />Refuser</>}
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert variant="secondary" className="mb-0" role="status">Ce devis n’est pas disponible pour une réponse en ligne.</Alert>
              )}
            </Card.Body>
          </Card>
        )}
        <div className="text-center text-secondary small mt-3">Édité avec JAMPACK</div>
      </div>
    </main>
  );
}
