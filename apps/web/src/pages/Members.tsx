import { useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';

export default function Members() {
  const utils = trpc.useUtils();
  const members = trpc.iam.members.useQuery();
  const roles = trpc.iam.roles.useQuery();
  const societes = trpc.iam.societes.useQuery();
  const invite = trpc.iam.invite.useMutation();
  const grant = trpc.iam.grantRole.useMutation();
  const revoke = trpc.iam.revokeRole.useMutation();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [g, setG] = useState({ userId: '', societeId: '', roleId: '' });

  const refresh = () => utils.iam.members.invalidate();
  const onInvite = async () => { if (!email) return; await invite.mutateAsync({ email, name: name || undefined }); setEmail(''); setName(''); refresh(); };
  const onGrant = async () => { if (!g.userId || !g.societeId || !g.roleId) return; await grant.mutateAsync(g); refresh(); };
  const onRevoke = async (r: { userId: string; societeId: string; roleId: string }) => { await revoke.mutateAsync(r); refresh(); };

  const users = members.data?.map((m) => m.user) ?? [];

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Utilisateurs & rôles</h4><p className="text-secondary mb-0">Membres du compte et leurs rôles par société</p></div>

      <div className="row g-3 mb-3">
        <div className="col-lg-5">
          <Card><Card.Header className="fw-semibold">Inviter un utilisateur</Card.Header><Card.Body>
            <Form.Group className="mb-2"><Form.Label className="small mb-1">Email</Form.Label><Form.Control size="sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" /></Form.Group>
            <Form.Group className="mb-2"><Form.Label className="small mb-1">Nom (optionnel)</Form.Label><Form.Control size="sm" value={name} onChange={(e) => setName(e.target.value)} /></Form.Group>
            <Button size="sm" onClick={onInvite} disabled={invite.isPending || !email}><i className="bi bi-person-plus me-1" />Inviter</Button>
            <div className="text-secondary small mt-2">L'utilisateur pourra se connecter via l'IdP avec cet email.</div>
            {invite.error && <div className="text-danger small mt-2">{invite.error.message}</div>}
          </Card.Body></Card>
        </div>
        <div className="col-lg-7">
          <Card><Card.Header className="fw-semibold">Attribuer un rôle</Card.Header><Card.Body>
            <div className="row g-2 align-items-end">
              <div className="col-md-4"><Form.Label className="small mb-1">Utilisateur</Form.Label>
                <Form.Select size="sm" value={g.userId} onChange={(e) => setG({ ...g, userId: e.target.value })}>
                  <option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
                </Form.Select></div>
              <div className="col-md-4"><Form.Label className="small mb-1">Société</Form.Label>
                <Form.Select size="sm" value={g.societeId} onChange={(e) => setG({ ...g, societeId: e.target.value })}>
                  <option value="">—</option>{societes.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Form.Select></div>
              <div className="col-md-3"><Form.Label className="small mb-1">Rôle</Form.Label>
                <Form.Select size="sm" value={g.roleId} onChange={(e) => setG({ ...g, roleId: e.target.value })}>
                  <option value="">—</option>{roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Form.Select></div>
              <div className="col-md-1"><Button size="sm" className="w-100" aria-label="Attribuer le rôle" onClick={onGrant} disabled={grant.isPending || !g.userId || !g.societeId || !g.roleId}><i className="bi bi-plus-lg" /></Button></div>
            </div>
            {grant.error && <div className="text-danger small mt-2">{grant.error.message}</div>}
          </Card.Body></Card>
        </div>
      </div>

      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th scope="col" className="ps-3">Utilisateur</th><th scope="col">Rôles par société</th></tr></thead>
          <tbody>
            {members.isLoading && <tr><td colSpan={2} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {members.data?.map((m) => (
              <tr key={m.user.id}>
                <td className="ps-3"><div className="fw-medium">{m.user.name ?? m.user.email}</div><div className="text-secondary small">{m.user.email}</div></td>
                <td>
                  {m.roles.length === 0 && <span className="text-secondary small">Aucun rôle</span>}
                  <div className="d-flex flex-wrap gap-2">
                    {m.roles.map((r) => (
                      <Badge key={`${r.societeId}-${r.roleId}`} bg="light" text="dark" className="border fw-normal d-inline-flex align-items-center gap-1">
                        {r.societe} · <span className="fw-medium">{r.role}</span>
                        <Button variant="link" size="sm" className="p-0 text-danger lh-1" title="Révoquer" onClick={() => onRevoke({ userId: r.userId, societeId: r.societeId, roleId: r.roleId })}><i className="bi bi-x" /></Button>
                      </Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body></Card>
      {revoke.error && <div className="text-danger small mt-2">{revoke.error.message}</div>}
    </>
  );
}
