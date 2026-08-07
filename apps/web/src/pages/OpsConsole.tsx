import { useMemo, useState } from 'react';
import { Card, Button, Badge, Modal, Form, Alert, Table, Spinner, Tabs, Tab } from 'react-bootstrap';
import { trpc } from '../trpc';

// Console super-admin de pilotage technique. Sections : mode instance (prod/test), diagnostic de
// configuration, configuration & clés (deux niveaux de visibilité), catalogue d'opérations, historique.

type OpParam = { key: string; label: string; type: string; required?: boolean; options?: { value: string; label: string }[]; placeholder?: string };
type Op = { id: string; label: string; description: string; category: string; danger: 'safe' | 'caution' | 'danger'; scope: string; warnings: string[]; params: OpParam[]; supportsDryRun: boolean; requiresConfirmation: boolean; confirmToken?: string; needsHostRunner: boolean };

const DANGER: Record<string, { bg: string; label: string }> = {
  safe: { bg: 'secondary', label: 'sûre' }, caution: { bg: 'warning', label: 'attention' }, danger: { bg: 'danger', label: 'sensible' },
};
const SEV: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: 'danger-subtle', text: 'danger', icon: 'bi-x-octagon' },
  warning: { bg: 'warning-subtle', text: 'warning', icon: 'bi-exclamation-triangle' },
  info: { bg: 'info-subtle', text: 'info', icon: 'bi-info-circle' },
};
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleString('fr-FR') : '—');

/** Mode d'instance (prod/test) + hébergement (self/jampack, contrôlé par le général). */
function InstanceMode() {
  const utils = trpc.useUtils();
  const status = trpc.instance.status.useQuery();
  const inval = () => { utils.instance.status.invalidate(); utils.ops.diagnostics.invalidate(); utils.ops.catalogue.invalidate(); utils.config.list.invalidate(); };
  const setMode = trpc.instance.setMode.useMutation({ onSuccess: inval });
  const setHosting = trpc.instance.setHosting.useMutation({ onSuccess: inval });
  const [confirm, setConfirm] = useState('');
  const mode = status.data?.mode ?? 'test';
  const hosting = status.data?.hosting ?? 'self';
  const isGeneral = status.data?.tier?.platform;

  return (
    <Card className="mb-3"><Card.Body>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <div className="text-secondary small">Mode de l'instance</div>
          <div className="fs-5 fw-semibold">{mode === 'prod' ? <Badge bg="danger">PRODUCTION</Badge> : <Badge bg="secondary">TEST</Badge>}</div>
        </div>
        <div>
          <div className="text-secondary small">Hébergement</div>
          <Badge bg={hosting === 'self' ? 'primary-subtle' : 'info-subtle'} text={hosting === 'self' ? 'primary' : 'info'} className="fw-normal">
            {hosting === 'self' ? 'Serveur du client (super-admin structure actif)' : 'Hébergé JAMPACK (piloté par le général)'}
          </Badge>
        </div>
        <div className="d-flex align-items-end gap-2">
          {mode !== 'prod' ? (
            <div>
              <Form.Label className="small mb-1 text-danger">Saisir « PROD » pour passer en production</Form.Label>
              <div className="d-flex gap-2">
                <Form.Control size="sm" style={{ maxWidth: 120 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="PROD" />
                <Button size="sm" variant="danger" disabled={setMode.isPending} onClick={() => setMode.mutate({ mode: 'prod', confirmation: confirm })}>Passer en prod</Button>
              </div>
            </div>
          ) : <Button size="sm" variant="outline-secondary" disabled={setMode.isPending} onClick={() => setMode.mutate({ mode: 'test' })}>Repasser en test</Button>}
        </div>
      </div>
      {isGeneral && (
        <div className="mt-2 pt-2 border-top small d-flex align-items-center gap-2">
          <span className="text-secondary">Général JAMPACK — hébergement :</span>
          <Button size="sm" variant={hosting === 'self' ? 'primary' : 'outline-secondary'} disabled={setHosting.isPending} onClick={() => setHosting.mutate({ hosting: 'self' })}>Serveur client</Button>
          <Button size="sm" variant={hosting === 'jampack' ? 'info' : 'outline-secondary'} disabled={setHosting.isPending} onClick={() => setHosting.mutate({ hosting: 'jampack' })}>Hébergé JAMPACK</Button>
        </div>
      )}
      {(setMode.isError || setHosting.isError) && <Alert variant="danger" className="py-1 px-2 small mb-0 mt-2">{(setMode.error || setHosting.error)?.message}</Alert>}
    </Card.Body></Card>
  );
}

/** Diagnostic des défauts de configuration. */
function Diagnostics() {
  const diag = trpc.ops.diagnostics.useQuery();
  const s = diag.data?.summary;
  return (
    <Card className="mb-3"><Card.Body>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="fw-semibold mb-0"><i className="bi bi-clipboard2-pulse me-2" />Diagnostic de configuration</h6>
        {s && <div className="d-flex gap-2">
          <Badge bg="danger-subtle" text="danger" className="fw-normal">{s.critical} critique(s)</Badge>
          <Badge bg="warning-subtle" text="warning" className="fw-normal">{s.warning} avert.</Badge>
          <Badge bg="info-subtle" text="info" className="fw-normal">{s.info} info</Badge>
        </div>}
      </div>
      {diag.isLoading && <Spinner size="sm" />}
      {diag.data?.findings.length === 0 && <div className="text-success small"><i className="bi bi-check-circle me-1" />Aucun défaut détecté sur cette instance.</div>}
      <div className="d-grid gap-2">
        {(diag.data?.findings ?? []).map((f: { id: string; severity: string; title: string; detail: string; remediation: string }) => {
          const sv = SEV[f.severity];
          return (
            <div key={f.id} className="border rounded-3 p-2">
              <div className="d-flex align-items-center gap-2 mb-1">
                <Badge bg={sv.bg} text={sv.text} className="fw-normal"><i className={`bi ${sv.icon} me-1`} />{f.severity}</Badge>
                <span className="fw-medium">{f.title}</span>
              </div>
              <div className="small text-secondary">{f.detail}</div>
              <div className="small"><i className="bi bi-wrench me-1" />{f.remediation}</div>
            </div>
          );
        })}
      </div>
      {diag.data?.fleetAggregationPending && <div className="small text-secondary mt-2"><i className="bi bi-diagram-3 me-1" />Agrégat multi-instances (flotte) à venir — portée actuelle : instance courante.</div>}
    </Card.Body></Card>
  );
}

/** Gestion de la configuration & des clés (deux niveaux : technicien révèle ; général masqué + push). */
function ConfigManager() {
  const utils = trpc.useUtils();
  const list = trpc.config.list.useQuery();
  const setEntry = trpc.config.set.useMutation({ onSuccess: () => { utils.config.list.invalidate(); utils.ops.diagnostics.invalidate(); setForm(null); } });
  const remove = trpc.config.remove.useMutation({ onSuccess: () => utils.config.list.invalidate() });
  const [form, setForm] = useState<{ name: string; value: string; secret: boolean; description: string } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const d = list.data;

  const reveal = async (name: string) => {
    const r = await utils.config.reveal.fetch({ name });
    setRevealed((s) => ({ ...s, [name]: r.value }));
  };

  return (
    <Card className="mb-3"><Card.Body>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="fw-semibold mb-0"><i className="bi bi-key me-2" />Configuration &amp; clés</h6>
        {d?.canWrite && <Button size="sm" onClick={() => setForm({ name: '', value: '', secret: true, description: '' })}><i className="bi bi-plus-lg me-1" />Ajouter</Button>}
      </div>
      {d && !d.encryptionEnabled && <Alert variant="warning" className="py-2 small"><i className="bi bi-unlock me-1" />Chiffrement au repos inactif (SECRETS_KEY absente) : les secrets sont stockés en clair.</Alert>}
      <Table hover responsive size="sm" className="mb-0 align-middle">
        <thead className="text-secondary small"><tr><th className="ps-2">Nom</th><th>Valeur</th><th>Type</th><th className="text-end pe-2">Actions</th></tr></thead>
        <tbody>
          {list.isLoading && <tr><td colSpan={4} className="text-center py-3"><Spinner size="sm" /></td></tr>}
          {(d?.items ?? []).map((it: { name: string; secret: boolean; display: string; description?: string | null }) => (
            <tr key={it.name}>
              <td className="ps-2 fw-medium">{it.name}{it.description && <div className="small text-secondary fw-normal">{it.description}</div>}</td>
              <td className="font-monospace small">{revealed[it.name] ?? it.display}</td>
              <td>{it.secret ? <Badge bg="secondary-subtle" text="secondary" className="fw-normal">secret</Badge> : <Badge bg="light" text="dark" className="fw-normal border">réglage</Badge>}</td>
              <td className="text-end pe-2">
                {it.secret && d?.canReveal && (revealed[it.name]
                  ? <Button size="sm" variant="light" title="Masquer" onClick={() => setRevealed((s) => { const n = { ...s }; delete n[it.name]; return n; })}><i className="bi bi-eye-slash" /></Button>
                  : <Button size="sm" variant="light" title="Révéler" onClick={() => reveal(it.name)}><i className="bi bi-eye" /></Button>)}
                {d?.canWrite && <Button size="sm" variant="light" title="Modifier" onClick={() => setForm({ name: it.name, value: '', secret: it.secret, description: it.description ?? '' })}><i className="bi bi-pencil" /></Button>}
                {d?.canDelete && <Button size="sm" variant="light" className="text-danger" title="Supprimer" onClick={() => remove.mutate({ name: it.name })}><i className="bi bi-trash" /></Button>}
              </td>
            </tr>
          ))}
          {list.isSuccess && (d?.items ?? []).length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-3">Aucune entrée de configuration</td></tr>}
        </tbody>
      </Table>

      <Modal show={!!form} onHide={() => setForm(null)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6">Entrée de configuration</Modal.Title></Modal.Header>
        <Modal.Body>
          {form && <>
            <Form.Group className="mb-2"><Form.Label className="small">Nom</Form.Label>
              <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ANTHROPIC_API_KEY" /></Form.Group>
            <Form.Group className="mb-2"><Form.Label className="small">Valeur {form.secret && <span className="text-secondary">(sera chiffrée si SECRETS_KEY)</span>}</Form.Label>
              <Form.Control type={form.secret ? 'password' : 'text'} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} autoComplete="off" /></Form.Group>
            <Form.Group className="mb-2"><Form.Label className="small">Description (facultatif)</Form.Label>
              <Form.Control value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Form.Group>
            <Form.Check type="switch" label="Valeur secrète (masquée pour le super-admin général)" checked={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.checked })} />
          </>}
          {setEntry.isError && <Alert variant="danger" className="py-2 small mb-0 mt-2">{setEntry.error.message}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setForm(null)}>Annuler</Button>
          <Button disabled={!form?.name || !form?.value || setEntry.isPending} onClick={() => form && setEntry.mutate({ name: form.name, value: form.value, secret: form.secret, description: form.description || undefined })}>Enregistrer</Button>
        </Modal.Footer>
      </Modal>
    </Card.Body></Card>
  );
}

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
      <Modal.Header closeButton><Modal.Title className="fs-5">{op.label} <Badge bg={d.bg} className="fw-normal align-middle ms-1">{d.label}</Badge></Modal.Title></Modal.Header>
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
        {op.supportsDryRun && <Button variant="outline-secondary" onClick={() => exec(true)} disabled={run.isPending}><i className="bi bi-play me-1" />Simuler</Button>}
        <Button variant={op.danger === 'danger' ? 'danger' : 'primary'} onClick={() => exec(false)} disabled={run.isPending}>{run.isPending ? <Spinner size="sm" /> : <><i className="bi bi-lightning-charge me-1" />Exécuter</>}</Button>
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
        <p className="text-secondary mb-0">Exploitation <strong>sans SSH ni console d'hébergement</strong> — catalogue prédéfini, configuration, diagnostic. Avertissements, simulation et confirmation.</p>
      </div>

      <Alert variant="warning" className="d-flex align-items-start gap-2">
        <i className="bi bi-shield-lock mt-1" />
        <div className="small">Zone <strong>super-admin</strong>. Aucune commande libre : seules des opérations validées sont proposées. Les actions sensibles exigent une <strong>confirmation typée</strong> ; les opérations hôte nécessitent un <strong>runner</strong> configuré (désactivé par défaut). Le super-admin <strong>général</strong> voit les secrets <strong>tronqués</strong>.</div>
      </Alert>

      <Tabs defaultActiveKey="etat" className="mb-3">
        <Tab eventKey="etat" title="État">
          <InstanceMode />
          <Diagnostics />
        </Tab>

        <Tab eventKey="config" title="Configuration & clés">
          <ConfigManager />
        </Tab>

        <Tab eventKey="ops" title="Opérations">
          {cat.isLoading && <div className="text-center py-4"><Spinner size="sm" /></div>}
          {byCategory.map((g) => (
            <div key={g.key} className="mb-3">
              <div className="text-secondary small text-uppercase mb-2">{g.label}</div>
              <div className="row g-2">
                {g.ops.map((o) => {
                  const d = DANGER[o.danger];
                  return (
                    <div className="col-md-6 col-xl-4" key={o.id}>
                      <Card className="h-100"><Card.Body className="d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-1"><span className="fw-semibold">{o.label}</span><Badge bg={d.bg} className="fw-normal">{d.label}</Badge></div>
                        <p className="text-secondary small flex-grow-1 mb-2">{o.description}</p>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="text-secondary small">{o.needsHostRunner ? <><i className="bi bi-hdd-network me-1" />hôte</> : <><i className="bi bi-cpu me-1" />en ligne</>}</span>
                          <Button size="sm" variant="outline-primary" onClick={() => setActive(o)}>Ouvrir</Button>
                        </div>
                      </Card.Body></Card>
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
        </Tab>
      </Tabs>

      {active && <OpRunner op={active} onClose={() => setActive(null)} />}
    </>
  );
}
