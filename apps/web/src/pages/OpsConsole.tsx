import { useMemo, useState } from 'react';
import { Card, Button, Badge, Modal, Form, Alert, Table, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';

// Console super-admin de pilotage technique. Catalogue d'opérations PRÉDÉFINIES (aucun shell libre) :
// exécution avec avertissements, dry-run, confirmation typée pour les actions sensibles, et audit.

type OpParam = { key: string; label: string; type: string; required?: boolean; options?: { value: string; label: string }[]; placeholder?: string; help?: string };
type Op = { id: string; label: string; description: string; category: string; danger: 'safe' | 'caution' | 'danger'; scope: string; warnings: string[]; params: OpParam[]; supportsDryRun: boolean; requiresConfirmation: boolean; confirmToken?: string; needsHostRunner: boolean };

const DANGER: Record<string, { bg: string; label: string }> = {
  safe: { bg: 'secondary', label: 'sûre' },
  caution: { bg: 'warning', label: 'attention' },
  danger: { bg: 'danger', label: 'sensible' },
};
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleString('fr-FR') : '—');

function OpRunner({ op, onClose }: { op: Op; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [params, setParams] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState('');
  const run = trpc.ops.run.useMutation();
  const [result, setResult] = useState<{ status: string; summary: string; details?: unknown } | null>(null);

  const exec = async (dryRun: boolean) => {
    setResult(null);
    const r = await run.mutateAsync({ id: op.id, params, dryRun, confirmation: confirmation || undefined });
    setResult(r);
    utils.ops.history.invalidate();
  };
  const d = DANGER[op.danger];

  return (
    <Modal show onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">{op.label} <Badge bg={d.bg} className="fw-normal align-middle ms-1">{d.label}</Badge></Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-secondary">{op.description}</p>
        {op.needsHostRunner && <Alert variant="secondary" className="py-2 small"><i className="bi bi-hdd-network me-1" />Opération hôte : nécessite un runner configuré (désactivé par défaut). Le dry-run reste disponible.</Alert>}
        {op.warnings.map((w, i) => <Alert key={i} variant="warning" className="py-2 small mb-2"><i className="bi bi-exclamation-triangle me-1" />{w}</Alert>)}

        {op.params.map((p) => (
          <Form.Group className="mb-2" key={p.key}>
            <Form.Label className="small mb-1">{p.label}{p.required && ' *'}</Form.Label>
            {p.type === 'select' && p.options
              ? <Form.Select value={params[p.key] ?? ''} onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}><option value="">—</option>{p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Form.Select>
              : <Form.Control type={p.type === 'number' ? 'number' : 'text'} placeholder={p.placeholder} value={params[p.key] ?? ''} onChange={(e) => setParams({ ...params, [p.key]: e.target.value })} />}
            {p.help && <Form.Text className="text-secondary">{p.help}</Form.Text>}
          </Form.Group>
        ))}

        {op.requiresConfirmation && (
          <Form.Group className="mb-2">
            <Form.Label className="small mb-1 text-danger">Pour exécuter, saisir « {op.confirmToken} »</Form.Label>
            <Form.Control value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={op.confirmToken} autoComplete="off" />
          </Form.Group>
        )}

        {run.isError && <Alert variant="danger" className="py-2 small mb-0 mt-2">{run.error.message}</Alert>}
        {result && (
          <Alert variant={result.status === 'ok' ? 'success' : result.status === 'blocked' ? 'secondary' : 'danger'} className="mt-3 mb-0">
            <div className="fw-semibold text-capitalize">{result.status}</div>
            <div className="small">{result.summary}</div>
            {result.details != null && Object.keys(result.details as object).length > 0 && (
              <pre className="small mb-0 mt-2 p-2 rounded" style={{ background: 'rgba(0,0,0,.05)', whiteSpace: 'pre-wrap' }}>{JSON.stringify(result.details, null, 2)}</pre>
            )}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onClose}>Fermer</Button>
        {op.supportsDryRun && <Button variant="outline-secondary" onClick={() => exec(true)} disabled={run.isPending}><i className="bi bi-play me-1" />Simuler (dry-run)</Button>}
        <Button variant={op.danger === 'danger' ? 'danger' : 'primary'} onClick={() => exec(false)} disabled={run.isPending}>
          {run.isPending ? <Spinner size="sm" /> : <><i className="bi bi-lightning-charge me-1" />Exécuter</>}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function OpsConsole() {
  const cat = trpc.ops.catalogue.useQuery();
  const history = trpc.ops.history.useQuery();
  const [active, setActive] = useState<Op | null>(null);

  const byCategory = useMemo(() => {
    const ops = (cat.data?.operations ?? []) as Op[];
    return (cat.data?.categories ?? []).map((c: { key: string; label: string }) => ({ ...c, ops: ops.filter((o) => o.category === c.key) })).filter((g) => g.ops.length);
  }, [cat.data]);

  return (
    <>
      <div className="mb-4">
        <h4 className="mb-1 fw-semibold">Pilotage technique</h4>
        <p className="text-secondary mb-0">Opérations d'exploitation <strong>sans SSH ni console d'hébergement</strong> — catalogue prédéfini, avec avertissements, simulation et confirmation.</p>
      </div>

      <Alert variant="warning" className="d-flex align-items-start gap-2">
        <i className="bi bi-shield-lock mt-1" />
        <div className="small">Zone <strong>super-admin</strong>. Aucune exécution de commande libre : seules des opérations validées sont proposées. Les actions sensibles exigent une <strong>confirmation typée</strong> ; les opérations touchant l'hôte nécessitent un <strong>runner</strong> configuré (désactivé par défaut).</div>
      </Alert>

      {cat.isLoading && <div className="text-center py-4"><Spinner size="sm" /></div>}
      {byCategory.map((g) => (
        <div key={g.key} className="mb-3">
          <div className="text-secondary small text-uppercase mb-2">{g.label}</div>
          <div className="row g-2">
            {g.ops.map((o) => {
              const d = DANGER[o.danger];
              return (
                <div className="col-md-6 col-xl-4" key={o.id}>
                  <Card className="h-100">
                    <Card.Body className="d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <span className="fw-semibold">{o.label}</span>
                        <Badge bg={d.bg} className="fw-normal">{d.label}</Badge>
                      </div>
                      <p className="text-secondary small flex-grow-1 mb-2">{o.description}</p>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-secondary small">{o.needsHostRunner ? <><i className="bi bi-hdd-network me-1" />hôte</> : <><i className="bi bi-cpu me-1" />en ligne</>}</span>
                        <Button size="sm" variant="outline-primary" onClick={() => setActive(o)}>Ouvrir</Button>
                      </div>
                    </Card.Body>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Card className="mt-2"><Card.Body className="p-0">
        <div className="p-3 pb-2"><h6 className="fw-semibold mb-0">Historique des exécutions</h6></div>
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th className="ps-3">Date</th><th>Opération</th><th>Cible</th><th>Mode</th><th className="pe-3">Résultat</th></tr></thead>
          <tbody>
            {history.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {(history.data?.rows ?? []).map((r: { id: string; createdAt: unknown; opId: string; target: string; dryRun: boolean; status: string; summary?: string | null }) => (
              <tr key={r.id}>
                <td className="ps-3 text-secondary">{dfmt(r.createdAt)}</td>
                <td className="fw-medium">{r.opId}</td>
                <td className="text-secondary">{r.target}</td>
                <td>{r.dryRun ? <Badge bg="secondary-subtle" text="secondary" className="fw-normal">simulation</Badge> : <Badge bg="primary-subtle" text="primary" className="fw-normal">réel</Badge>}</td>
                <td className="pe-3"><Badge bg={r.status === 'ok' ? 'success-subtle' : r.status === 'blocked' ? 'secondary-subtle' : 'danger-subtle'} text={r.status === 'ok' ? 'success' : r.status === 'blocked' ? 'secondary' : 'danger'} className="fw-normal">{r.status}</Badge> <span className="small text-secondary">{r.summary}</span></td>
              </tr>
            ))}
            {history.isSuccess && (history.data?.rows ?? []).length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucune exécution</td></tr>}
          </tbody>
        </Table>
      </Card.Body></Card>

      {active && <OpRunner op={active} onClose={() => setActive(null)} />}
    </>
  );
}
