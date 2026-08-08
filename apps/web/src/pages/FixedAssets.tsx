import { useState } from 'react';
import { Card, Table, Spinner, Button, Form, Row, Col, Modal } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

function ScheduleModal({ id, onClose }: { id: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const can = useCan();
  const q = trpc.accounting.fixedAssets.schedule.useQuery({ id });
  const post = trpc.accounting.fixedAssets.postDepreciation.useMutation({
    onSuccess: () => { utils.accounting.fixedAssets.schedule.invalidate({ id }); utils.accounting.balance.invalidate(); utils.accounting.entries.list.invalidate(); },
  });
  const d = q.data;
  const editable = can('create', 'Accounting');
  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>Plan d'amortissement</Modal.Title></Modal.Header>
      <Modal.Body>
        {!d ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
          <>
            <p className="mb-2"><strong>{d.asset.name}</strong> — {euro.format(d.asset.amountHt)} sur {d.asset.durationYears} ans (linéaire)</p>
            <Table size="sm" className="align-middle">
              <thead className="text-secondary small"><tr><th scope="col">Exercice</th><th scope="col" className="text-end">Annuité</th><th scope="col" className="text-end">Cumul</th><th scope="col" className="text-end">VNC</th><th scope="col" className="text-end" /></tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td className="text-end">{euro.format(r.annuity)}</td>
                    <td className="text-end text-secondary">{euro.format(r.cumulated)}</td>
                    <td className="text-end fw-medium">{euro.format(r.residual)}</td>
                    <td className="text-end">
                      {r.posted
                        ? <i className="bi bi-journal-check text-success" title="Comptabilisée" />
                        : editable && <Button variant="light" size="sm" title="Comptabiliser la dotation (681/281)" onClick={() => post.mutate({ id, year: r.year })} disabled={post.isPending}><i className="bi bi-journal-plus" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="text-secondary small mb-0">VNC = valeur nette comptable. La dotation se comptabilise au journal OD (681 → 281).</p>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}

export default function FixedAssets() {
  const utils = trpc.useUtils();
  const can = useCan();
  const list = trpc.accounting.fixedAssets.list.useQuery();
  const create = trpc.accounting.fixedAssets.create.useMutation({ onSuccess: () => { utils.accounting.fixedAssets.list.invalidate(); setForm(blank); } });
  const remove = trpc.accounting.fixedAssets.remove.useMutation({ onSuccess: () => utils.accounting.fixedAssets.list.invalidate() });
  const editable = can('manage', 'all');
  const blank = { name: '', accountCode: '', amountHt: '', acquisitionDate: '', durationYears: '5' };
  const [form, setForm] = useState(blank);
  const [schedule, setSchedule] = useState<string | null>(null);

  const add = () => {
    if (!form.name.trim() || !(num(form.amountHt) > 0) || !form.acquisitionDate) return;
    create.mutate({ name: form.name.trim(), accountCode: form.accountCode || undefined, amountHt: num(form.amountHt), acquisitionDate: form.acquisitionDate, durationYears: num(form.durationYears) || 5 });
  };

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Immobilisations</h4><p className="text-secondary mb-0">Biens amortissables et plans d'amortissement (linéaire)</p></div>

      {editable && (
        <Card className="mb-3"><Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={3}><Form.Label className="small mb-1">Désignation</Form.Label><Form.Control size="sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Col>
            <Col md={2}><Form.Label className="small mb-1">Compte</Form.Label><Form.Control size="sm" placeholder="215000" value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })} /></Col>
            <Col md={2}><Form.Label className="small mb-1">Montant HT</Form.Label><Form.Control size="sm" type="number" step="0.01" value={form.amountHt} onChange={(e) => setForm({ ...form, amountHt: e.target.value })} /></Col>
            <Col md={2}><Form.Label className="small mb-1">Acquisition</Form.Label><Form.Control size="sm" type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} /></Col>
            <Col md={2}><Form.Label className="small mb-1">Durée (ans)</Form.Label><Form.Control size="sm" type="number" value={form.durationYears} onChange={(e) => setForm({ ...form, durationYears: e.target.value })} /></Col>
            <Col md={1}><Button size="sm" className="w-100" aria-label="Ajouter l'immobilisation" onClick={add} disabled={create.isPending}><i className="bi bi-plus-lg" /></Button></Col>
          </Row>
        </Card.Body></Card>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Désignation</th><th scope="col">Compte</th><th scope="col">Acquisition</th><th scope="col" className="text-end">Montant HT</th><th scope="col" className="text-center">Durée</th><th scope="col" className="text-end pe-3" /></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={6} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {list.data?.map((a) => (
                <tr key={a.id}>
                  <td className="ps-3 fw-medium">{a.name}</td>
                  <td className="text-secondary">{a.accountCode ?? '—'}</td>
                  <td className="text-secondary">{dfmt(a.acquisitionDate)}</td>
                  <td className="text-end">{euro.format(num(a.amountHt))}</td>
                  <td className="text-center">{a.durationYears} ans</td>
                  <td className="text-end pe-3">
                    <Button variant="light" size="sm" className="me-1" title="Plan d'amortissement" onClick={() => setSchedule(a.id)}><i className="bi bi-graph-down" /></Button>
                    {editable && <Button variant="light" size="sm" className="text-danger" onClick={() => { if (confirm('Supprimer cette immobilisation ?')) remove.mutate({ id: a.id }); }}><i className="bi bi-trash" /></Button>}
                  </td>
                </tr>
              ))}
              {list.isSuccess && list.data.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Aucune immobilisation</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {schedule && <ScheduleModal id={schedule} onClose={() => setSchedule(null)} />}
    </>
  );
}
