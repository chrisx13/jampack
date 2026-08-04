import { useState } from 'react';
import { Row, Col, Card, Table, Button, Form, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';

function num(v: unknown): number {
  const n = Number(v as never);
  return Number.isFinite(n) ? n : 0;
}

function Stat({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: string | number }) {
  return (
    <Card className="h-100">
      <Card.Body className="d-flex align-items-center gap-3">
        <span className={`stat-icon bg-${tone}-subtle text-${tone}`}>
          <i className={`bi ${icon}`} />
        </span>
        <div>
          <div className="fs-4 fw-semibold lh-1">{value}</div>
          <div className="text-secondary small">{label}</div>
        </div>
      </Card.Body>
    </Card>
  );
}

export default function Dashboard() {
  const utils = trpc.useUtils();
  const companies = trpc.crm.companies.list.useQuery();
  const contacts = trpc.crm.contacts.list.useQuery();
  const opportunities = trpc.crm.opportunities.list.useQuery();
  const summary = trpc.analytics.summary.useQuery();

  const [name, setName] = useState('');
  const create = trpc.crm.companies.create.useMutation({
    onSuccess: () => {
      setName('');
      utils.crm.companies.list.invalidate();
    },
  });

  const pipelineValue = (opportunities.data ?? []).reduce((s, o) => s + num(o.amount), 0);
  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  return (
    <>
      <div className="mb-4">
        <h4 className="mb-1 fw-semibold">Tableau de bord</h4>
        <p className="text-secondary mb-0">Vue d'ensemble de la société sélectionnée</p>
      </div>

      <Row className="g-3 mb-4">
        <Col sm={6} xl={3}><Stat icon="bi-briefcase" tone="primary" label="Clients" value={companies.data?.length ?? '—'} /></Col>
        <Col sm={6} xl={3}><Stat icon="bi-people" tone="info" label="Contacts" value={contacts.data?.length ?? '—'} /></Col>
        <Col sm={6} xl={3}><Stat icon="bi-graph-up-arrow" tone="success" label="Opportunités" value={opportunities.data?.length ?? '—'} /></Col>
        <Col sm={6} xl={3}><Stat icon="bi-cash-stack" tone="warning" label="CA pipeline" value={euro.format(pipelineValue)} /></Col>
      </Row>

      <div className="text-secondary small text-uppercase fw-semibold mb-2" style={{ letterSpacing: '.05em' }}>Finances</div>
      <Row className="g-3 mb-4">
        <Col sm={6} xl>{<Stat icon="bi-receipt" tone="primary" label="CA facturé" value={summary.data ? euro.format(summary.data.caFacture) : '—'} />}</Col>
        <Col sm={6} xl><Stat icon="bi-hourglass-split" tone="warning" label="Encours clients" value={summary.data ? euro.format(summary.data.encoursClients) : '—'} /></Col>
        <Col sm={6} xl><Stat icon="bi-cart" tone="danger" label="Encours fournisseurs" value={summary.data ? euro.format(summary.data.encoursFournisseurs) : '—'} /></Col>
        <Col sm={6} xl><Stat icon="bi-boxes" tone="info" label="Valeur stock" value={summary.data ? euro.format(summary.data.valeurStock) : '—'} /></Col>
        <Col sm={6} xl><Stat icon="bi-percent" tone="success" label="TVA à décaisser" value={summary.data ? euro.format(summary.data.tvaAPayer) : '—'} /></Col>
      </Row>

      <Row className="g-3">
        <Col lg={8}>
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between">
              <span className="fw-semibold">Clients</span>
              {companies.isFetching && <Spinner size="sm" />}
            </Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0 align-middle">
                <thead className="text-secondary small">
                  <tr>
                    <th className="ps-3">Nom</th>
                    <th>Société</th>
                    <th className="text-end pe-3">Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.data?.map((c) => (
                    <tr key={c.id}>
                      <td className="ps-3 fw-medium">{c.name}</td>
                      <td className="text-secondary">{c.societe?.name ?? '—'}</td>
                      <td className="text-end pe-3 text-secondary">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                  {companies.data?.length === 0 && (
                    <tr><td colSpan={3} className="text-center text-secondary py-4">Aucun client pour cette société</td></tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card>
            <Card.Header className="fw-semibold">Nouveau client</Card.Header>
            <Card.Body>
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) create.mutate({ name: name.trim() });
                }}
              >
                <Form.Group className="mb-3">
                  <Form.Label>Nom</Form.Label>
                  <Form.Control value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Fournil Central" />
                  <Form.Text className="text-secondary">Rattaché à la société active.</Form.Text>
                </Form.Group>
                <Button type="submit" disabled={create.isPending || !name.trim()} className="w-100">
                  {create.isPending ? <Spinner size="sm" /> : <><i className="bi bi-plus-lg me-1" /> Ajouter</>}
                </Button>
                {create.error && <div className="text-danger small mt-2">{create.error.message}</div>}
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
