import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

type Company = {
  id: string; name: string; siren: string | null; siret?: string | null; tvaNumber?: string | null; doNotProspect?: boolean; processingRestricted?: boolean;
  factorId?: string | null; factorMandatory?: boolean; paymentTermId?: string | null;
  societe?: { name: string } | null;
  _count?: { establishments: number; contacts: number };
};

// ── Gestion des établissements d'un client ──
function EstablishmentsModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const utils = trpc.useUtils();
  const can = useCan();
  const canEdit = can('update', 'Company');
  const list = trpc.crm.establishments.list.useQuery({ companyId: company.id });

  const blank = { name: '', siret: '', addressLine1: '', postalCode: '', city: '', isHeadquarters: false, isBilling: false, isDelivery: false };
  const [form, setForm] = useState<typeof blank & { id?: string }>(blank);
  const [editing, setEditing] = useState(false);

  const done = () => { utils.crm.establishments.list.invalidate({ companyId: company.id }); utils.crm.companies.list.invalidate(); setEditing(false); setForm(blank); };
  const create = trpc.crm.establishments.create.useMutation({ onSuccess: done });
  const update = trpc.crm.establishments.update.useMutation({ onSuccess: done });
  const remove = trpc.crm.establishments.remove.useMutation({ onSuccess: () => utils.crm.establishments.list.invalidate({ companyId: company.id }) });

  const submit = () => {
    if (!form.name.trim()) return;
    const { id, ...f } = form;
    if (id) update.mutate({ id, ...f, siret: f.siret || null, addressLine1: f.addressLine1 || null, postalCode: f.postalCode || null, city: f.city || null });
    else create.mutate({ companyId: company.id, ...f, siret: f.siret || undefined, addressLine1: f.addressLine1 || undefined, postalCode: f.postalCode || undefined, city: f.city || undefined });
  };
  const busy = create.isPending || update.isPending;

  return (
    <Modal show onHide={onClose} centered size="lg">
      <Modal.Header closeButton><Modal.Title>Établissements — {company.name}</Modal.Title></Modal.Header>
      <Modal.Body>
        {list.isLoading && <Spinner size="sm" />}
        <div className="d-flex flex-column gap-2 mb-3">
          {list.data?.map((e) => (
            <div key={e.id} className="d-flex align-items-start justify-content-between border rounded-3 p-2">
              <div>
                <div className="fw-medium">
                  {e.name}
                  {e.isHeadquarters && <Badge bg="primary-subtle" text="primary" className="ms-2 fw-normal">Siège</Badge>}
                  {e.isBilling && <Badge bg="warning-subtle" text="warning" className="ms-1 fw-normal">Facturation</Badge>}
                  {e.isDelivery && <Badge bg="info-subtle" text="info" className="ms-1 fw-normal">Livraison</Badge>}
                </div>
                <div className="text-secondary small">
                  {[e.addressLine1, [e.postalCode, e.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Adresse non renseignée'}
                  {e.siret && <> · SIRET {e.siret}</>}
                </div>
              </div>
              {canEdit && (
                <div className="flex-shrink-0">
                  <Button variant="light" size="sm" className="me-1" onClick={() => { setForm({ id: e.id, name: e.name, siret: e.siret ?? '', addressLine1: e.addressLine1 ?? '', postalCode: e.postalCode ?? '', city: e.city ?? '', isHeadquarters: e.isHeadquarters, isBilling: e.isBilling, isDelivery: e.isDelivery }); setEditing(true); }}><i className="bi bi-pencil" /></Button>
                  <Button variant="light" size="sm" className="text-danger" onClick={() => remove.mutate({ id: e.id })}><i className="bi bi-trash" /></Button>
                </div>
              )}
            </div>
          ))}
          {list.data?.length === 0 && <div className="text-secondary small">Aucun établissement.</div>}
        </div>

        {canEdit && !editing && (
          <Button variant="outline-primary" size="sm" onClick={() => { setForm(blank); setEditing(true); }}><i className="bi bi-plus-lg me-1" />Ajouter un établissement</Button>
        )}

        {editing && (
          <div className="border rounded-3 p-3 mt-2">
            <div className="row g-2">
              <div className="col-md-6"><Form.Label>Nom</Form.Label><Form.Control autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Siège, Agence…" /></div>
              <div className="col-md-6"><Form.Label>SIRET</Form.Label><Form.Control value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} placeholder="14 chiffres" /></div>
              <div className="col-12"><Form.Label>Adresse</Form.Label><Form.Control value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></div>
              <div className="col-md-4"><Form.Label>Code postal</Form.Label><Form.Control value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
              <div className="col-md-8"><Form.Label>Ville</Form.Label><Form.Control value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div className="d-flex gap-3 mt-3">
              <Form.Check label="Siège" checked={form.isHeadquarters} onChange={(e) => setForm({ ...form, isHeadquarters: e.target.checked })} />
              <Form.Check label="Facturation" checked={form.isBilling} onChange={(e) => setForm({ ...form, isBilling: e.target.checked })} />
              <Form.Check label="Livraison" checked={form.isDelivery} onChange={(e) => setForm({ ...form, isDelivery: e.target.checked })} />
            </div>
            <div className="mt-3 text-end">
              <Button variant="light" size="sm" className="me-2" onClick={() => { setEditing(false); setForm(blank); }}>Annuler</Button>
              <Button size="sm" onClick={submit} disabled={busy || !form.name.trim()}>{busy ? <Spinner size="sm" /> : 'Enregistrer'}</Button>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}

export default function Clients() {
  const utils = trpc.useUtils();
  const list = trpc.crm.companies.list.useQuery();
  const factors = trpc.billing.factors.list.useQuery();
  const paymentTerms = trpc.billing.paymentTerms.list.useQuery();
  const can = useCan();

  const [edit, setEdit] = useState<null | Partial<Company>>(null);
  const [del, setDel] = useState<Company | null>(null);
  const [anon, setAnon] = useState<Company | null>(null);
  const [estab, setEstab] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', siren: '', siret: '', tvaNumber: '', doNotProspect: false, processingRestricted: false, factorId: '', factorMandatory: false, paymentTermId: '' });

  const invalidate = () => utils.crm.companies.list.invalidate();
  const create = trpc.crm.companies.create.useMutation({ onSuccess: () => { invalidate(); setEdit(null); } });
  const update = trpc.crm.companies.update.useMutation({ onSuccess: () => { invalidate(); setEdit(null); } });
  const remove = trpc.crm.companies.remove.useMutation({ onSuccess: () => { invalidate(); setDel(null); } });
  const anonymize = trpc.crm.companies.anonymize.useMutation({ onSuccess: () => { invalidate(); setAnon(null); } });

  const open = (row?: Company) => { setForm({ name: row?.name ?? '', siren: row?.siren ?? '', siret: row?.siret ?? '', tvaNumber: row?.tvaNumber ?? '', doNotProspect: !!row?.doNotProspect, processingRestricted: !!row?.processingRestricted, factorId: row?.factorId ?? '', factorMandatory: !!row?.factorMandatory, paymentTermId: row?.paymentTermId ?? '' }); setEdit(row ?? {}); };
  const submit = () => {
    if (!form.name.trim()) return;
    const billing = { factorMandatory: form.factorMandatory };
    const ids = { siren: form.siren || null, siret: form.siret || null, tvaNumber: form.tvaNumber || null };
    if (edit && 'id' in edit && edit.id) update.mutate({ id: edit.id, name: form.name.trim(), ...ids, doNotProspect: form.doNotProspect, processingRestricted: form.processingRestricted, factorId: form.factorId || null, paymentTermId: form.paymentTermId || null, ...billing });
    else create.mutate({ name: form.name.trim(), siren: form.siren || undefined, siret: form.siret || undefined, tvaNumber: form.tvaNumber || undefined, doNotProspect: form.doNotProspect, processingRestricted: form.processingRestricted, factorId: form.factorId || undefined, paymentTermId: form.paymentTermId || undefined, ...billing });
  };
  const exportRgpd = async (c: Company) => {
    const data = await utils.crm.companies.exportData.fetch({ id: c.id });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `rgpd-${c.name.replace(/\s+/g, '-').toLowerCase()}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const busy = create.isPending || update.isPending;

  const [search, setSearch] = useState('');
  const all = list.data ?? [];
  const q = search.trim().toLowerCase();
  const rows = q ? all.filter((c) => c.name.toLowerCase().includes(q) || (c.siren ?? '').toLowerCase().includes(q)) : all;
  const showSearch = all.length > 5;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="mb-0 fw-semibold">Clients</h4>
        {can('create', 'Company') && <Button onClick={() => open()}><i className="bi bi-plus-lg me-1" />Nouveau client</Button>}
      </div>

      {showSearch && (
        <div className="position-relative mb-3" style={{ maxWidth: 360 }}>
          <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <Form.Control size="sm" className="ps-4" placeholder="Rechercher un client (nom ou SIREN)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th className="ps-3">Nom</th><th>SIREN</th><th>Établissements</th><th>Société</th><th className="text-end pe-3">Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="ps-3 fw-medium">{c.name}
                    {(c as Company).doNotProspect && <Badge bg="warning-subtle" text="warning" className="fw-normal ms-2"><i className="bi bi-slash-circle me-1" />ne pas prospecter</Badge>}
                    {(c as Company).processingRestricted && <Badge bg="secondary-subtle" text="secondary" className="fw-normal ms-2"><i className="bi bi-lock me-1" />traitement limité</Badge>}
                  </td>
                  <td className="text-secondary">{c.siren ?? '—'}</td>
                  <td>
                    <Button variant="light" size="sm" onClick={() => setEstab(c as Company)}>
                      <i className="bi bi-geo-alt me-1" />{c._count?.establishments ?? 0}
                    </Button>
                  </td>
                  <td className="text-secondary">{c.societe?.name ?? '—'}</td>
                  <td className="text-end pe-3">
                    <Button variant="light" size="sm" className="me-1" title="Export RGPD (données personnelles)" onClick={() => exportRgpd(c as Company)}><i className="bi bi-download" /></Button>
                    {can('update', 'Company') && <Button variant="light" size="sm" className="me-1" onClick={() => open(c as Company)}><i className="bi bi-pencil" /></Button>}
                    {can('delete', 'Company') && <Button variant="light" size="sm" className="me-1 text-warning" title="Anonymiser (RGPD — conserve les pièces comptables)" onClick={() => setAnon(c as Company)}><i className="bi bi-person-x" /></Button>}
                    {can('delete', 'Company') && <Button variant="light" size="sm" className="text-danger" onClick={() => setDel(c as Company)}><i className="bi bi-trash" /></Button>}
                  </td>
                </tr>
              ))}
              {all.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucun client pour cette société</td></tr>}
              {all.length > 0 && rows.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucun client ne correspond à « {search} »</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={edit !== null} onHide={() => setEdit(null)} centered>
        <Modal.Header closeButton><Modal.Title>{edit && 'id' in edit ? 'Modifier le client' : 'Nouveau client'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3"><Form.Label>Nom</Form.Label><Form.Control autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Form.Group>
          <div className="row g-2 mb-3">
            <div className="col-md-4"><Form.Label>SIREN</Form.Label><Form.Control value={form.siren} onChange={(e) => setForm({ ...form, siren: e.target.value })} placeholder="9 chiffres" /></div>
            <div className="col-md-4"><Form.Label>SIRET</Form.Label><Form.Control value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} placeholder="14 chiffres" /></div>
            <div className="col-md-4"><Form.Label>N° TVA</Form.Label><Form.Control value={form.tvaNumber} onChange={(e) => setForm({ ...form, tvaNumber: e.target.value })} placeholder="FR…" /></div>
          </div>
          <Form.Check type="switch" id="doNotProspect" className="mb-2" label="Ne pas prospecter (droit d'opposition RGPD)" checked={form.doNotProspect} onChange={(e) => setForm({ ...form, doNotProspect: e.target.checked })} />
          <Form.Check type="switch" id="processingRestricted" className="mb-3" label="Traitement limité (RGPD art. 18) — aucune nouvelle pièce" checked={form.processingRestricted} onChange={(e) => setForm({ ...form, processingRestricted: e.target.checked })} />
          <Form.Group className="mb-3">
            <Form.Label>Condition de paiement (défaut pour ce client)</Form.Label>
            <Form.Select value={form.paymentTermId} onChange={(e) => setForm({ ...form, paymentTermId: e.target.value })}>
              <option value="">— Défaut société —</option>
              {(paymentTerms.data ?? []).filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.label} ({t.days} j)</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Affactureur (subrogation)</Form.Label>
            <Form.Select value={form.factorId} onChange={(e) => setForm({ ...form, factorId: e.target.value, factorMandatory: e.target.value ? form.factorMandatory : false })}>
              <option value="">— Aucun —</option>
              {(factors.data ?? []).filter((f) => f.isActive).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Check type="switch" id="factorMandatory" label="Subrogation obligatoire pour ce client" checked={form.factorMandatory} disabled={!form.factorId} onChange={(e) => setForm({ ...form, factorMandatory: e.target.checked })} />
          {(create.error || update.error) && <div className="text-danger small mt-2">{(create.error || update.error)?.message}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setEdit(null)}>Annuler</Button>
          <Button onClick={submit} disabled={busy || !form.name.trim()}>{busy ? <Spinner size="sm" /> : 'Enregistrer'}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={del !== null} onHide={() => setDel(null)} centered>
        <Modal.Header closeButton><Modal.Title>Supprimer</Modal.Title></Modal.Header>
        <Modal.Body>Supprimer le client <strong>{del?.name}</strong> et ses établissements ? Action irréversible.</Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setDel(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => del && remove.mutate({ id: del.id })} disabled={remove.isPending}>{remove.isPending ? <Spinner size="sm" /> : 'Supprimer'}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={anon !== null} onHide={() => setAnon(null)} centered>
        <Modal.Header closeButton><Modal.Title>Anonymiser (RGPD)</Modal.Title></Modal.Header>
        <Modal.Body>
          Anonymiser <strong>{anon?.name}</strong> : l'identité (nom, SIREN/SIRET/TVA) et les contacts sont
          effacés définitivement, mais les <strong>pièces comptables</strong> sont conservées (réserve
          légale 10 ans). Répond au droit à l'effacement (art. 17 RGPD). Action irréversible.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setAnon(null)}>Annuler</Button>
          <Button variant="warning" onClick={() => anon && anonymize.mutate({ id: anon.id })} disabled={anonymize.isPending}>{anonymize.isPending ? <Spinner size="sm" /> : 'Anonymiser'}</Button>
        </Modal.Footer>
      </Modal>

      {estab && <EstablishmentsModal company={estab} onClose={() => setEstab(null)} />}
    </>
  );
}
