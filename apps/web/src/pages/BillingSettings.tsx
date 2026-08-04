import { useState } from 'react';
import { Card, Button, Form, Row, Col, Badge, InputGroup, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';
import { isValidIban, isValidBic, formatIban } from '@jampack/domain';

function DefaultBadge({ on }: { on: boolean }) {
  return on ? <Badge bg="primary-subtle" text="primary" className="fw-normal">défaut</Badge> : null;
}

function BankAccounts() {
  const utils = trpc.useUtils();
  const q = trpc.billing.bankAccounts.list.useQuery();
  const inv = () => utils.billing.bankAccounts.list.invalidate();
  const create = trpc.billing.bankAccounts.create.useMutation({ onSuccess: inv });
  const update = trpc.billing.bankAccounts.update.useMutation({ onSuccess: inv });
  const archive = trpc.billing.bankAccounts.archive.useMutation({ onSuccess: inv });
  const [f, setF] = useState({ label: '', iban: '', bic: '', isDefault: false });

  return (
    <Card className="mb-3"><Card.Header className="fw-semibold">Comptes bancaires</Card.Header><Card.Body>
      {(q.data ?? []).filter((b) => b.isActive).map((b) => (
        <div key={b.id} className="d-flex align-items-center gap-2 mb-2">
          <div className="flex-grow-1"><span className="fw-medium">{b.label}</span> <span className="text-secondary small">{formatIban(b.iban)}{b.bic ? ` · ${b.bic}` : ''}</span></div>
          <DefaultBadge on={b.isDefault} />
          {!b.isDefault && <Button size="sm" variant="light" title="Définir par défaut" onClick={() => update.mutate({ id: b.id, isDefault: true })}><i className="bi bi-star" /></Button>}
          <Button size="sm" variant="light" className="text-danger" title="Archiver" onClick={() => archive.mutate({ id: b.id })}><i className="bi bi-archive" /></Button>
        </div>
      ))}
      <Row className="g-2 mt-1">
        <Col md={4}><Form.Control size="sm" placeholder="Libellé" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Col>
        <Col md={4}><Form.Control size="sm" placeholder="IBAN" value={f.iban} isInvalid={!!f.iban.trim() && !isValidIban(f.iban)} onChange={(e) => setF({ ...f, iban: e.target.value })} /></Col>
        <Col md={2}><Form.Control size="sm" placeholder="BIC" value={f.bic} isInvalid={!!f.bic.trim() && !isValidBic(f.bic)} onChange={(e) => setF({ ...f, bic: e.target.value })} /></Col>
        <Col md={2}><Button size="sm" disabled={!f.label.trim() || !isValidIban(f.iban) || (!!f.bic.trim() && !isValidBic(f.bic)) || create.isPending} onClick={() => { create.mutate({ label: f.label.trim(), iban: f.iban.replace(/\s+/g, '').toUpperCase(), bic: f.bic ? f.bic.replace(/\s+/g, '').toUpperCase() : undefined, isDefault: (q.data ?? []).length === 0 }); setF({ label: '', iban: '', bic: '', isDefault: false }); }}><i className="bi bi-plus-lg" /></Button></Col>
      </Row>
      {!!f.iban.trim() && !isValidIban(f.iban) && <div className="text-danger small mt-1">IBAN invalide (clé de contrôle).</div>}
    </Card.Body></Card>
  );
}

function PaymentTerms() {
  const utils = trpc.useUtils();
  const q = trpc.billing.paymentTerms.list.useQuery();
  const inv = () => utils.billing.paymentTerms.list.invalidate();
  const create = trpc.billing.paymentTerms.create.useMutation({ onSuccess: inv });
  const update = trpc.billing.paymentTerms.update.useMutation({ onSuccess: inv });
  const archive = trpc.billing.paymentTerms.archive.useMutation({ onSuccess: inv });
  const [f, setF] = useState({ label: '', days: '30' });

  return (
    <Card className="mb-3"><Card.Header className="fw-semibold">Conditions de paiement</Card.Header><Card.Body>
      <p className="text-secondary small">La condition « défaut » s'applique à tous les clients ; une condition peut aussi être choisie par client ou par facture.</p>
      {(q.data ?? []).filter((t) => t.isActive).map((t) => (
        <div key={t.id} className="d-flex align-items-center gap-2 mb-2">
          <div className="flex-grow-1"><span className="fw-medium">{t.label}</span> <span className="text-secondary small">échéance {t.days} j</span></div>
          <DefaultBadge on={t.isDefault} />
          {!t.isDefault && <Button size="sm" variant="light" title="Définir par défaut" onClick={() => update.mutate({ id: t.id, isDefault: true })}><i className="bi bi-star" /></Button>}
          <Button size="sm" variant="light" className="text-danger" title="Archiver" onClick={() => archive.mutate({ id: t.id })}><i className="bi bi-archive" /></Button>
        </div>
      ))}
      <Row className="g-2 mt-1">
        <Col md={6}><Form.Control size="sm" placeholder="Libellé (ex. 30 jours)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Col>
        <Col md={4}><InputGroup size="sm"><Form.Control type="number" placeholder="Jours" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /><InputGroup.Text>j</InputGroup.Text></InputGroup></Col>
        <Col md={2}><Button size="sm" disabled={!f.label.trim() || create.isPending} onClick={() => { create.mutate({ label: f.label.trim(), days: Number(f.days) || 0, isDefault: (q.data ?? []).length === 0 }); setF({ label: '', days: '30' }); }}><i className="bi bi-plus-lg" /></Button></Col>
      </Row>
    </Card.Body></Card>
  );
}

function Factors() {
  const utils = trpc.useUtils();
  const q = trpc.billing.factors.list.useQuery();
  const inv = () => utils.billing.factors.list.invalidate();
  const create = trpc.billing.factors.create.useMutation({ onSuccess: inv });
  const archive = trpc.billing.factors.archive.useMutation({ onSuccess: inv });
  const [f, setF] = useState({ name: '', iban: '', bic: '' });

  return (
    <Card className="mb-3"><Card.Header className="fw-semibold">Affactureurs (subrogation)</Card.Header><Card.Body>
      <p className="text-secondary small">Plusieurs affactureurs possibles ; s'attribuent par client (optionnel ou obligatoire) et se choisissent par facture.</p>
      {(q.data ?? []).filter((x) => x.isActive).map((x) => (
        <div key={x.id} className="d-flex align-items-center gap-2 mb-2">
          <div className="flex-grow-1"><span className="fw-medium">{x.name}</span> <span className="text-secondary small">{formatIban(x.iban)}</span></div>
          <Badge bg="secondary-subtle" text="secondary" className="fw-normal">{x._count.companies} client(s)</Badge>
          <Button size="sm" variant="light" className="text-danger" title="Archiver" onClick={() => archive.mutate({ id: x.id })}><i className="bi bi-archive" /></Button>
        </div>
      ))}
      <Row className="g-2 mt-1">
        <Col md={4}><Form.Control size="sm" placeholder="Nom" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Col>
        <Col md={4}><Form.Control size="sm" placeholder="IBAN (optionnel)" value={f.iban} isInvalid={!!f.iban.trim() && !isValidIban(f.iban)} onChange={(e) => setF({ ...f, iban: e.target.value })} /></Col>
        <Col md={2}><Form.Control size="sm" placeholder="BIC" value={f.bic} isInvalid={!!f.bic.trim() && !isValidBic(f.bic)} onChange={(e) => setF({ ...f, bic: e.target.value })} /></Col>
        <Col md={2}><Button size="sm" disabled={!f.name.trim() || (!!f.iban.trim() && !isValidIban(f.iban)) || (!!f.bic.trim() && !isValidBic(f.bic)) || create.isPending} onClick={() => { create.mutate({ name: f.name.trim(), iban: f.iban ? f.iban.replace(/\s+/g, '').toUpperCase() : undefined, bic: f.bic ? f.bic.replace(/\s+/g, '').toUpperCase() : undefined }); setF({ name: '', iban: '', bic: '' }); }}><i className="bi bi-plus-lg" /></Button></Col>
      </Row>
    </Card.Body></Card>
  );
}

function Addresses() {
  const utils = trpc.useUtils();
  const q = trpc.billing.addresses.list.useQuery();
  const inv = () => utils.billing.addresses.list.invalidate();
  const create = trpc.billing.addresses.create.useMutation({ onSuccess: inv });
  const archive = trpc.billing.addresses.archive.useMutation({ onSuccess: inv });
  const [f, setF] = useState({ label: '', addressLine1: '', postalCode: '', city: '' });

  return (
    <Card className="mb-3"><Card.Header className="fw-semibold">Adresses de la société</Card.Header><Card.Body>
      {(q.data ?? []).filter((a) => a.isActive).map((a) => (
        <div key={a.id} className="d-flex align-items-center gap-2 mb-2">
          <div className="flex-grow-1"><span className="fw-medium">{a.label}</span> <span className="text-secondary small">{[a.addressLine1, [a.postalCode, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span></div>
          {a.isHeadquarters && <Badge bg="info-subtle" text="info" className="fw-normal">siège</Badge>}
          {a.isBilling && <Badge bg="success-subtle" text="success" className="fw-normal">facturation</Badge>}
          <DefaultBadge on={a.isDefault} />
          <Button size="sm" variant="light" className="text-danger" title="Archiver" onClick={() => archive.mutate({ id: a.id })}><i className="bi bi-archive" /></Button>
        </div>
      ))}
      <Row className="g-2 mt-1">
        <Col md={3}><Form.Control size="sm" placeholder="Libellé" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Col>
        <Col md={4}><Form.Control size="sm" placeholder="Adresse" value={f.addressLine1} onChange={(e) => setF({ ...f, addressLine1: e.target.value })} /></Col>
        <Col md={2}><Form.Control size="sm" placeholder="CP" value={f.postalCode} onChange={(e) => setF({ ...f, postalCode: e.target.value })} /></Col>
        <Col md={2}><Form.Control size="sm" placeholder="Ville" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Col>
        <Col md={1}><Button size="sm" disabled={!f.label.trim() || create.isPending} onClick={() => { create.mutate({ label: f.label.trim(), addressLine1: f.addressLine1 || undefined, postalCode: f.postalCode || undefined, city: f.city || undefined, isDefault: (q.data ?? []).length === 0 }); setF({ label: '', addressLine1: '', postalCode: '', city: '' }); }}><i className="bi bi-plus-lg" /></Button></Col>
      </Row>
    </Card.Body></Card>
  );
}

export default function BillingSettings() {
  const q = trpc.billing.bankAccounts.list.useQuery();
  if (q.isLoading) return <div className="text-center py-5"><Spinner /></div>;
  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Facturation — banques, conditions, affactureurs, adresses</h4><p className="text-secondary mb-0">Éléments multiples de la société active, utilisés sur les factures.</p></div>
      <Row className="g-3">
        <Col lg={6}><BankAccounts /><PaymentTerms /></Col>
        <Col lg={6}><Factors /><Addresses /></Col>
      </Row>
    </>
  );
}
