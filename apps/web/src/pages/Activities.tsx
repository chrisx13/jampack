import { useState } from 'react';
import { Card, Table, Spinner, Button, Badge, Form, Row, Col } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { activityTypeLabel, isActivityOverdue } from '@jampack/domain';

const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const TYPE_ICON: Record<string, string> = { note: 'bi-sticky', appel: 'bi-telephone', email: 'bi-envelope', rdv: 'bi-calendar-event', tache: 'bi-check2-square' };

export default function Activities() {
  const utils = trpc.useUtils();
  const can = useCan();
  const editable = can('create', 'Opportunity');
  const tasks = trpc.crm.activities.tasks.useQuery();
  const [filterCompany, setFilterCompany] = useState('');
  const log = trpc.crm.activities.list.useQuery(filterCompany ? { companyId: filterCompany } : undefined);
  const companies = trpc.crm.companies.list.useQuery();

  const [type, setType] = useState('note');
  const [content, setContent] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const refresh = () => { utils.crm.activities.tasks.invalidate(); utils.crm.activities.list.invalidate(); };
  const create = trpc.crm.activities.create.useMutation({ onSuccess: () => { setContent(''); setDueAt(''); refresh(); } });
  const complete = trpc.crm.activities.complete.useMutation({ onSuccess: refresh });
  const reopen = trpc.crm.activities.reopen.useMutation({ onSuccess: refresh });
  const remove = trpc.crm.activities.remove.useMutation({ onSuccess: refresh });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !companyId) return;
    create.mutate({ type: type as 'note', content: content.trim(), companyId, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined });
  };

  const openTasks = tasks.data ?? [];
  const feed = log.data ?? [];

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Activités &amp; tâches</h4><p className="text-secondary mb-0">Notes, appels, rendez-vous et tâches de relance rattachés à vos clients</p></div>

      <Row className="g-3">
        <Col lg={5}>
          {editable && (
            <Card className="mb-3">
              <Card.Body>
                <h6 className="fw-semibold mb-3">Nouvelle activité</h6>
                <Form onSubmit={submit}>
                  <Row className="g-2 mb-2">
                    <Col xs={6}><Form.Select aria-label="Type d'activité" size="sm" value={type} onChange={(e) => setType(e.target.value)}>{['note', 'appel', 'email', 'rdv', 'tache'].map((t) => <option key={t} value={t}>{activityTypeLabel(t)}</option>)}</Form.Select></Col>
                    <Col xs={6}><Form.Control aria-label="Échéance (tâche)" size="sm" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} title="Échéance (tâche)" /></Col>
                  </Row>
                  <Form.Select aria-label="Client concerné" size="sm" className="mb-2" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
                    <option value="">— Client —</option>
                    {(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Form.Select>
                  <Form.Control aria-label="Contenu de l'activité" as="textarea" size="sm" rows={2} className="mb-2" placeholder="Contenu…" value={content} onChange={(e) => setContent(e.target.value)} required />
                  <Button type="submit" size="sm" variant="primary" disabled={create.isPending || !content.trim() || !companyId}>Enregistrer</Button>
                </Form>
              </Card.Body>
            </Card>
          )}

          <Card>
            <Card.Header className="bg-transparent fw-semibold">Tâches à faire {openTasks.length > 0 && <Badge bg="secondary" className="ms-1">{openTasks.length}</Badge>}</Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0 align-middle">
                <tbody>
                  {tasks.isLoading && <tr><td className="text-center py-4"><Spinner size="sm" /></td></tr>}
                  {openTasks.map((a) => {
                    const overdue = isActivityOverdue(a);
                    return (
                      <tr key={a.id}>
                        <td className="ps-3">
                          <div className="fw-medium">{a.content}</div>
                          <div className="small text-secondary">{a.company?.name ?? '—'} · échéance {dfmt(a.dueAt)} {overdue && <Badge bg="danger-subtle" text="danger" className="fw-normal ms-1">en retard</Badge>}</div>
                        </td>
                        <td className="text-end pe-3">
                          <Button variant="outline-success" size="sm" title="Marquer fait" onClick={() => complete.mutate({ id: a.id })} disabled={complete.isPending}><i className="bi bi-check-lg" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                  {tasks.isSuccess && openTasks.length === 0 && <tr><td className="text-center text-secondary py-4">Aucune tâche en attente 🎉</td></tr>}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card>
            <Card.Header className="bg-transparent d-flex align-items-center justify-content-between gap-2">
              <span className="fw-semibold">Journal d'activité</span>
              <Form.Select aria-label="Filtrer le journal par client" size="sm" style={{ maxWidth: 220 }} value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} title="Filtrer par client">
                <option value="">Tous les clients</option>
                {(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0 align-middle">
                <tbody>
                  {log.isLoading && <tr><td className="text-center py-4"><Spinner size="sm" /></td></tr>}
                  {feed.map((a) => (
                    <tr key={a.id}>
                      <td className="ps-3" style={{ width: 40 }}><i className={`bi ${TYPE_ICON[a.type] ?? 'bi-dot'} text-secondary`} title={activityTypeLabel(a.type)} /></td>
                      <td>
                        <div className={a.done ? 'text-decoration-line-through text-secondary' : ''}>{a.content}</div>
                        <div className="small text-secondary">{a.company?.name ?? (a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : '—')} · {dfmt(a.createdAt)}</div>
                      </td>
                      <td className="text-end pe-3">
                        {editable && a.type === 'tache' && (a.done
                          ? <Button variant="link" size="sm" className="text-secondary p-0 me-2" title="Rouvrir la tâche" onClick={() => reopen.mutate({ id: a.id })}><i className="bi bi-arrow-counterclockwise" /></Button>
                          : <Button variant="link" size="sm" className="text-success p-0 me-2" title="Marquer fait" onClick={() => complete.mutate({ id: a.id })}><i className="bi bi-check-lg" /></Button>)}
                        {editable && <Button variant="link" size="sm" className="text-danger p-0" title="Supprimer" onClick={() => { if (confirm('Supprimer cette activité ?')) remove.mutate({ id: a.id }); }}><i className="bi bi-trash" /></Button>}
                      </td>
                    </tr>
                  ))}
                  {log.isSuccess && feed.length === 0 && <tr><td className="text-center text-secondary py-4">Aucune activité</td></tr>}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
