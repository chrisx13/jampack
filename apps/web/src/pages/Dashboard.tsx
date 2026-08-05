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

const KIND_ICON: Record<string, string> = {
  tache: 'bi-check2-square', facture_client: 'bi-arrow-down-circle', facture_fournisseur: 'bi-arrow-up-circle', livraison: 'bi-truck',
};
// Vue à ouvrir selon le type d'échéance (tableau de bord → écran concerné).
const KIND_VIEW: Record<string, string> = {
  tache: 'activities', facture_client: 'echeancier', facture_fournisseur: 'supplier-echeancier', livraison: 'purchase-orders',
};
const openViewFor = (kind: string) => {
  const id = KIND_VIEW[kind];
  if (id) window.dispatchEvent(new CustomEvent('jampack:open-view', { detail: id }));
};

export default function Dashboard() {
  const utils = trpc.useUtils();
  const companies = trpc.crm.companies.list.useQuery();
  const contacts = trpc.crm.contacts.list.useQuery();
  const opportunities = trpc.crm.opportunities.list.useQuery();
  const summary = trpc.analytics.summary.useQuery();
  const agenda = trpc.analytics.agenda.useQuery({ days: 14 });

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
              <span className="fw-semibold">À traiter <span className="text-secondary fw-normal small">— 14 prochains jours</span></span>
              {agenda.data && agenda.data.overdueCount > 0 && <span className="badge bg-danger-subtle text-danger fw-normal">{agenda.data.overdueCount} en retard</span>}
            </Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0 align-middle">
                <tbody>
                  {agenda.isLoading && <tr><td className="text-center py-4"><Spinner size="sm" /></td></tr>}
                  {(agenda.data?.events ?? []).slice(0, 8).map((e) => (
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => openViewFor(e.kind)}>
                      <td className="ps-3" style={{ width: 36 }}><i className={`bi ${KIND_ICON[e.kind] ?? 'bi-dot'} text-secondary`} aria-hidden="true" /></td>
                      <td>
                        <button type="button" className="btn btn-link p-0 text-decoration-none text-body fw-medium text-truncate d-block" style={{ maxWidth: '100%' }} onClick={(ev) => { ev.stopPropagation(); openViewFor(e.kind); }}>{e.label}<span className="visually-hidden"> — ouvrir</span></button>
                        <div className="small text-secondary">{e.party}</div>
                      </td>
                      <td className="text-end pe-3 text-nowrap">
                        {e.amount != null && <span className="fw-medium me-2">{euro.format(e.amount)}</span>}
                        <span className={`small ${e.overdue ? 'text-danger' : 'text-secondary'}`}>{new Date(e.date as unknown as string).toLocaleDateString('fr-FR')}{e.overdue ? ' ⚠' : ''}</span>
                      </td>
                    </tr>
                  ))}
                  {agenda.isSuccess && (agenda.data?.events.length ?? 0) === 0 && (
                    <tr><td className="text-center text-secondary py-4">Rien à traiter sur les 14 prochains jours 🎉</td></tr>
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
