import { useState } from 'react';
import { Card, Table, Button, Form, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';

export default function Societes() {
  const utils = trpc.useUtils();
  const list = trpc.societes.listAll.useQuery();
  const create = trpc.societes.create.useMutation();

  const [f, setF] = useState({ name: '', siren: '', siret: '', tvaNumber: '', city: '' });
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  const add = async () => {
    if (!f.name) return;
    await create.mutateAsync({ name: f.name, siren: f.siren || undefined, siret: f.siret || undefined, tvaNumber: f.tvaNumber || undefined, city: f.city || undefined });
    setF({ name: '', siren: '', siret: '', tvaNumber: '', city: '' });
    utils.societes.listAll.invalidate();
    utils.societes.list.invalidate(); // le sélecteur reflète la nouvelle société accessible
  };

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Sociétés du compte</h4><p className="text-secondary mb-0">Entités juridiques gérées dans le compte</p></div>

      <Card className="mb-3"><Card.Header className="fw-semibold">Nouvelle société</Card.Header><Card.Body>
        <div className="row g-2 align-items-end">
          <div className="col-md-4"><Form.Label className="small mb-1">Nom</Form.Label><Form.Control size="sm" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Ma Société SARL" /></div>
          <div className="col-md-2"><Form.Label className="small mb-1">SIREN</Form.Label><Form.Control size="sm" value={f.siren} onChange={(e) => set('siren', e.target.value)} /></div>
          <div className="col-md-2"><Form.Label className="small mb-1">SIRET</Form.Label><Form.Control size="sm" value={f.siret} onChange={(e) => set('siret', e.target.value)} /></div>
          <div className="col-md-2"><Form.Label className="small mb-1">Ville</Form.Label><Form.Control size="sm" value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
          <div className="col-md-2"><Button size="sm" className="w-100" onClick={add} disabled={create.isPending || !f.name}><i className="bi bi-plus-lg me-1" />Créer</Button></div>
        </div>
        {create.error && <div className="text-danger small mt-2">{create.error.message}</div>}
      </Card.Body></Card>

      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th className="ps-3">Nom</th><th>Ville</th><th>SIRET</th><th className="pe-3">SIREN</th></tr></thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={4} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {list.data?.map((s) => (
              <tr key={s.id}><td className="ps-3 fw-medium">{s.name}</td><td className="text-secondary">{s.city ?? '—'}</td><td className="text-secondary">{s.siret ?? '—'}</td><td className="pe-3 text-secondary">{s.siren ?? '—'}</td></tr>
            ))}
          </tbody>
        </Table>
      </Card.Body></Card>
    </>
  );
}
