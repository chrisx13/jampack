import { useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

export default function Warehouses() {
  const utils = trpc.useUtils();
  const can = useCan();
  const list = trpc.stock.warehouses.list.useQuery();
  const create = trpc.stock.warehouses.create.useMutation();
  const update = trpc.stock.warehouses.update.useMutation();
  const archive = trpc.stock.warehouses.archive.useMutation();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const refresh = () => utils.stock.warehouses.list.invalidate();
  const add = async () => {
    if (!name) return;
    await create.mutateAsync({ name, code: code || undefined, city: city || undefined, isDefault });
    setName(''); setCode(''); setCity(''); setIsDefault(false); refresh();
  };
  const setDefault = async (id: string) => { await update.mutateAsync({ id, isDefault: true }); refresh(); };
  const arch = async (id: string) => { await archive.mutateAsync({ id }); refresh(); };

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Entrepôts</h4><p className="text-secondary mb-0">Lieux de stockage de la société</p></div>

      {can('create', 'Warehouse') && (
        <Card className="mb-3">
          <Card.Body>
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <Form.Label className="small mb-1">Nom</Form.Label>
                <Form.Control size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Réserve principale" />
              </div>
              <div className="col-md-2">
                <Form.Label className="small mb-1">Code</Form.Label>
                <Form.Control size="sm" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Ville</Form.Label>
                <Form.Control size="sm" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="col-md-2 pb-1">
                <Form.Check type="checkbox" label="Par défaut" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              </div>
              <div className="col-md-1">
                <Button size="sm" className="w-100" onClick={add} disabled={create.isPending || !name}><i className="bi bi-plus-lg" /></Button>
              </div>
            </div>
            {create.error && <div className="text-danger small mt-2">{create.error.message}</div>}
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Nom</th><th scope="col">Code</th><th scope="col">Ville</th><th scope="col" /><th scope="col" className="text-end pe-3" /></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {list.data?.filter((w) => w.isActive).map((w) => (
                <tr key={w.id}>
                  <td className="ps-3 fw-medium">{w.name}</td>
                  <td className="text-secondary">{w.code ?? '—'}</td>
                  <td className="text-secondary">{w.city ?? '—'}</td>
                  <td>{w.isDefault && <Badge bg="primary-subtle" text="primary" className="fw-normal">Par défaut</Badge>}</td>
                  <td className="text-end pe-3">
                    {can('update', 'Warehouse') && !w.isDefault && <Button variant="light" size="sm" className="me-1" title="Définir par défaut" onClick={() => setDefault(w.id)}><i className="bi bi-star" /></Button>}
                    {can('update', 'Warehouse') && <Button variant="light" size="sm" className="text-danger" title="Archiver" onClick={() => arch(w.id)}><i className="bi bi-archive" /></Button>}
                  </td>
                </tr>
              ))}
              {list.data?.filter((w) => w.isActive).length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucun entrepôt</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
