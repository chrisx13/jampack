import { useState } from 'react';
import { Card, Table, Button, Form, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

export default function ChartOfAccounts() {
  const utils = trpc.useUtils();
  const can = useCan();
  const accounts = trpc.accounting.accounts.list.useQuery();
  const journals = trpc.accounting.journals.list.useQuery();
  const create = trpc.accounting.accounts.create.useMutation();
  const initPcg = trpc.accounting.accounts.initPcg.useMutation();
  const initJournals = trpc.accounting.journals.initDefaults.useMutation();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = (accounts.data ?? []).filter((a) => !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));

  const refresh = () => { utils.accounting.accounts.list.invalidate(); utils.accounting.journals.list.invalidate(); };
  const add = async () => { if (!code || !name) return; await create.mutateAsync({ code, name }); setCode(''); setName(''); refresh(); };
  const doInit = async () => { await initPcg.mutateAsync(); await initJournals.mutateAsync(); refresh(); };

  const empty = accounts.isSuccess && accounts.data.length === 0;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Plan comptable</h4><p className="text-secondary mb-0">Comptes (PCG) & journaux de la société</p></div>
        {can('manage', 'all') && empty && <Button onClick={doInit} disabled={initPcg.isPending}><i className="bi bi-magic me-1" />Initialiser PCG + journaux</Button>}
      </div>

      {can('manage', 'all') && !empty && (
        <Card className="mb-3"><Card.Body>
          <div className="row g-2 align-items-end">
            <div className="col-md-3"><Form.Label className="small mb-1">N° compte</Form.Label><Form.Control size="sm" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex. 707000" /></div>
            <div className="col-md-6"><Form.Label className="small mb-1">Libellé</Form.Label><Form.Control size="sm" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="col-md-3"><Button size="sm" className="w-100" onClick={add} disabled={create.isPending || !code || !name}><i className="bi bi-plus-lg me-1" />Ajouter</Button></div>
          </div>
          {create.error && <div className="text-danger small mt-2">{create.error.message}</div>}
        </Card.Body></Card>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          {(accounts.data?.length ?? 0) > 8 && (
            <div className="position-relative mb-2" style={{ maxWidth: 360 }}>
              <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
              <input className="form-control form-control-sm ps-4" aria-label="Rechercher un compte" placeholder="Rechercher (n° ou libellé)…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}
          <Card><Card.Body className="p-0">
            <Table hover responsive className="mb-0 align-middle">
              <thead className="text-secondary small"><tr><th scope="col" className="ps-3">Compte</th><th scope="col">Libellé</th><th scope="col" className="pe-3">Classe</th></tr></thead>
              <tbody>
                {accounts.isLoading && <tr><td colSpan={3} className="text-center py-4"><Spinner size="sm" /></td></tr>}
                {filtered.map((a) => (
                  <tr key={a.id}><td className="ps-3 fw-medium">{a.code}</td><td>{a.name}</td><td className="pe-3 text-secondary">{a.class}</td></tr>
                ))}
                {empty && <tr><td colSpan={3} className="text-center text-secondary py-4">Aucun compte — initialisez le PCG</td></tr>}
                {!empty && accounts.isSuccess && filtered.length === 0 && <tr><td colSpan={3} className="text-center text-secondary py-4">Aucun compte pour cette recherche</td></tr>}
              </tbody>
            </Table>
          </Card.Body></Card>
        </div>
        <div className="col-lg-5">
          <Card><Card.Body className="p-0">
            <Table className="mb-0 align-middle"><thead className="text-secondary small"><tr><th scope="col" className="ps-3">Journal</th><th scope="col">Libellé</th><th scope="col" className="pe-3">Type</th></tr></thead>
              <tbody>
                {journals.data?.map((j) => (<tr key={j.id}><td className="ps-3 fw-medium">{j.code}</td><td>{j.name}</td><td className="pe-3 text-secondary">{j.type}</td></tr>))}
                {journals.isSuccess && journals.data.length === 0 && <tr><td colSpan={3} className="text-center text-secondary py-3">Aucun journal</td></tr>}
              </tbody>
            </Table>
          </Card.Body></Card>
        </div>
      </div>
    </>
  );
}
