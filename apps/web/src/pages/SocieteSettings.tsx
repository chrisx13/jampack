import { useEffect, useState } from 'react';
import { Card, Button, Form, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { frTvaNumber, isValidSiren } from '@jampack/domain';

type Settings = Record<string, string | boolean | null | undefined>;

export default function SocieteSettings() {
  const utils = trpc.useUtils();
  const q = trpc.societes.settings.useQuery();
  const can = useCan();
  const editable = can('manage', 'all');
  const [form, setForm] = useState<Settings>({});

  useEffect(() => { if (q.data) setForm(q.data as unknown as Settings); }, [q.data]);

  const save = trpc.societes.updateSettings.useMutation({
    onSuccess: () => { utils.societes.settings.invalidate(); utils.societes.list.invalidate(); },
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const val = (k: string) => (form[k] == null ? '' : String(form[k]));

  const submit = () => {
    const keys = ['name', 'legalForm', 'capital', 'siren', 'siret', 'tvaNumber', 'rcs', 'ape', 'addressLine1', 'addressLine2', 'postalCode', 'city', 'phone', 'email', 'website', 'logoUrl', 'legalMentions', 'cgv', 'penaltyRate', 'discountTerms'];
    const payload: Settings = {};
    for (const k of keys) payload[k] = (form[k] as string) ?? '';
    payload.vatFranchise = !!form.vatFranchise;
    payload.vatOnPayments = !!form.vatOnPayments;
    save.mutate(payload as never);
  };

  if (q.isLoading) return <div className="text-center py-5"><Spinner /></div>;

  const Text = ({ k, label, as, type }: { k: string; label: string; as?: 'textarea'; type?: string }) => (
    <Form.Group className="mb-3">
      <Form.Label className="small text-secondary mb-1">{label}</Form.Label>
      <Form.Control as={as} rows={as ? 2 : undefined} type={type} value={val(k)} onChange={(e) => set(k, e.target.value)} disabled={!editable} />
    </Form.Group>
  );

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-1 fw-semibold">Société — paramétrage facturation</h4>
          <p className="text-secondary mb-0">En-tête et pied de page des documents (facture, devis…).</p>
        </div>
        {editable && <Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner size="sm" /> : <><i className="bi bi-check2 me-1" />Enregistrer</>}</Button>}
      </div>
      {!editable && <Alert variant="warning" className="py-2">Seule l'administration peut modifier ce paramétrage.</Alert>}
      {save.isSuccess && <Alert variant="success" className="py-2">Paramétrage enregistré.</Alert>}

      <Row className="g-3">
        <Col lg={6}>
          <Card className="mb-3"><Card.Header className="fw-semibold">Identité</Card.Header><Card.Body>
            <Text k="name" label="Raison sociale" />
            <Row><Col md={6}><Text k="legalForm" label="Forme juridique" /></Col><Col md={6}><Text k="capital" label="Capital social" /></Col></Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small text-secondary mb-1">SIREN</Form.Label>
                  <Form.Control
                    value={val('siren')} disabled={!editable}
                    isInvalid={!!val('siren').trim() && !isValidSiren(val('siren'))}
                    onChange={(e) => set('siren', e.target.value)}
                    // Auto-remplit la TVA intracommunautaire (règle DGFiP) si le champ est vide.
                    onBlur={() => { const t = frTvaNumber(val('siren')); if (t && !val('tvaNumber').trim()) set('tvaNumber', t); }}
                  />
                  <Form.Control.Feedback type="invalid">Clé de contrôle invalide.</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}><Text k="siret" label="SIRET" /></Col>
            </Row>
            <Row><Col md={4}><Text k="tvaNumber" label="TVA intracom" /></Col><Col md={4}><Text k="rcs" label="RCS" /></Col><Col md={4}><Text k="ape" label="APE/NAF" /></Col></Row>
          </Card.Body></Card>

          <Card className="mb-3"><Card.Header className="fw-semibold">Coordonnées</Card.Header><Card.Body>
            <Text k="addressLine1" label="Adresse" />
            <Text k="addressLine2" label="Complément" />
            <Row><Col md={4}><Text k="postalCode" label="Code postal" /></Col><Col md={8}><Text k="city" label="Ville" /></Col></Row>
            <Row><Col md={6}><Text k="phone" label="Téléphone" /></Col><Col md={6}><Text k="email" label="E-mail" type="email" /></Col></Row>
            <Row><Col md={6}><Text k="website" label="Site web" /></Col><Col md={6}><Text k="logoUrl" label="Logo (URL)" /></Col></Row>
          </Card.Body></Card>
        </Col>

        <Col lg={6}>
          <Card className="mb-3"><Card.Header className="fw-semibold">Mentions légales & TVA</Card.Header><Card.Body>
            <Form.Check
              type="switch" id="vatFranchise" className="mb-3"
              label="Franchise en base de TVA (art. 293 B CGI) — mention d'exonération sur les factures"
              checked={!!form.vatFranchise} disabled={!editable}
              onChange={(e) => set('vatFranchise', e.target.checked)}
            />
            <Form.Check
              type="switch" id="vatOnPayments" className="mb-3"
              label="TVA sur les encaissements (services) — mention « TVA acquittée d'après les encaissements »"
              checked={!!form.vatOnPayments} disabled={!editable}
              onChange={(e) => set('vatOnPayments', e.target.checked)}
            />
            <Text k="penaltyRate" label="Taux des pénalités de retard (LME) — défaut : trois fois le taux d'intérêt légal" />
            <Text k="discountTerms" label="Escompte pour paiement anticipé — vide = « Pas d'escompte » (mention obligatoire art. L441-10)" />
            <Text k="legalMentions" label="Mentions légales complémentaires" as="textarea" />
            <Text k="cgv" label="CGV (référence ou texte)" as="textarea" />
          </Card.Body></Card>
          <Alert variant="light" className="border small mb-0">
            Les <strong>comptes bancaires</strong>, <strong>conditions de paiement</strong>, <strong>affactureurs</strong> et <strong>adresses</strong> (multiples) se gèrent dans <strong>Administration ▸ Facturation</strong>.
          </Alert>
        </Col>
      </Row>
      {save.error && <div className="text-danger small mt-2">{save.error.message}</div>}
    </>
  );
}
