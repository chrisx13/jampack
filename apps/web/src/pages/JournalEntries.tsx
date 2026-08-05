import { useMemo, useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

type Line = { accountId: string; label: string; debit: number; credit: number };

function Editor({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const journals = trpc.accounting.journals.list.useQuery();
  const accounts = trpc.accounting.accounts.list.useQuery();
  const create = trpc.accounting.entries.create.useMutation();

  const [journalId, setJournalId] = useState('');
  const [date, setDate] = useState('');
  const [reference, setReference] = useState('');
  const [label, setLabel] = useState('');
  const [lines, setLines] = useState<Line[]>([{ accountId: '', label: '', debit: 0, credit: 0 }, { accountId: '', label: '', debit: 0, credit: 0 }]);

  const totalDebit = useMemo(() => Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100, [lines]);
  const totalCredit = useMemo(() => Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100, [lines]);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { accountId: '', label: '', debit: 0, credit: 0 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, k) => k !== i));

  const save = async () => {
    await create.mutateAsync({
      journalId, date, reference: reference || undefined, label,
      lines: lines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0)).map((l) => ({ accountId: l.accountId, label: l.label || undefined, debit: l.debit, credit: l.credit })),
    });
    utils.accounting.entries.list.invalidate(); utils.accounting.balance.invalidate();
    onClose();
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button variant="light" onClick={onClose}><i className="bi bi-arrow-left" /></Button>
          <h4 className="mb-0 fw-semibold">Nouvelle écriture</h4>
        </div>
        <Button onClick={save} disabled={create.isPending || !journalId || !date || !label || !balanced}><i className="bi bi-check2-circle me-1" />Enregistrer</Button>
      </div>

      <Card className="mb-3"><Card.Body>
        <div className="row g-3">
          <div className="col-md-3"><Form.Label>Journal</Form.Label>
            <Form.Select value={journalId} onChange={(e) => setJournalId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {journals.data?.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-2"><Form.Label>Date</Form.Label><Form.Control type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="col-md-3"><Form.Label>Pièce (réf.)</Form.Label><Form.Control value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          <div className="col-md-4"><Form.Label>Libellé</Form.Label><Form.Control value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        </div>
      </Card.Body></Card>

      <Card className="mb-3"><Card.Body className="p-0">
        <Table className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th className="ps-3" style={{ width: 260 }}>Compte</th><th>Libellé</th><th className="text-end" style={{ width: 140 }}>Débit</th><th className="text-end" style={{ width: 140 }}>Crédit</th><th style={{ width: 50 }} /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="ps-3">
                  <Form.Select size="sm" value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })}>
                    <option value="">— Compte —</option>
                    {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </Form.Select>
                </td>
                <td><Form.Control size="sm" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} /></td>
                <td><Form.Control size="sm" type="number" step="0.01" className="text-end" value={l.debit || ''} onChange={(e) => setLine(i, { debit: num(e.target.value), credit: 0 })} /></td>
                <td><Form.Control size="sm" type="number" step="0.01" className="text-end" value={l.credit || ''} onChange={(e) => setLine(i, { credit: num(e.target.value), debit: 0 })} /></td>
                <td className="text-end pe-2">{lines.length > 2 && <Button variant="light" size="sm" className="text-danger" onClick={() => removeLine(i)}><i className="bi bi-trash" /></Button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-top">
              <td className="ps-3" colSpan={2}><Button variant="light" size="sm" onClick={addLine}><i className="bi bi-plus-lg me-1" />Ligne</Button></td>
              <td className="text-end fw-semibold">{euro.format(totalDebit)}</td>
              <td className="text-end fw-semibold">{euro.format(totalCredit)}</td>
              <td />
            </tr>
          </tfoot>
        </Table>
      </Card.Body></Card>

      <div>
        {balanced ? <Badge bg="success-subtle" text="success" className="fw-normal"><i className="bi bi-check2 me-1" />Équilibrée</Badge>
          : <Badge bg="warning-subtle" text="warning" className="fw-normal"><i className="bi bi-exclamation-triangle me-1" />Écart : {euro.format(totalDebit - totalCredit)}</Badge>}
        {create.error && <div className="text-danger small mt-2">{create.error.message}</div>}
      </div>
    </>
  );
}

export default function JournalEntries() {
  const utils = trpc.useUtils();
  const list = trpc.accounting.entries.list.useQuery(undefined);
  const can = useCan();
  const [editing, setEditing] = useState(false);

  if (editing) return <Editor onClose={() => setEditing(false)} />;

  const exportCsv = async () => {
    const r = await utils.accounting.entries.exportCsv.fetch();
    const url = URL.createObjectURL(new Blob([r.content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Écritures</h4><p className="text-secondary mb-0">Journal des écritures comptables — export importable par les logiciels d'expert-comptable</p></div>
        <div className="d-flex gap-2">
          {(list.data?.length ?? 0) > 0 && <Button variant="light" title="Export CSV des écritures (interop expert-comptable)" onClick={exportCsv}><i className="bi bi-filetype-csv me-1" />CSV écritures</Button>}
          {can('create', 'Accounting') && <Button onClick={() => setEditing(true)}><i className="bi bi-plus-lg me-1" />Nouvelle écriture</Button>}
        </div>
      </div>

      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th className="ps-3">Date</th><th>Journal</th><th>Pièce</th><th>Libellé</th><th className="text-end pe-3">Montant</th></tr></thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {list.data?.map((e) => (
              <tr key={e.id}>
                <td className="ps-3 text-secondary">{dfmt(e.date)}</td>
                <td><Badge bg="secondary-subtle" text="secondary" className="fw-normal">{e.journal?.code}</Badge></td>
                <td className="text-secondary">{e.reference ?? '—'}</td>
                <td>{e.label}</td>
                <td className="text-end pe-3 fw-medium">{euro.format(e.total)}</td>
              </tr>
            ))}
            {list.data?.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucune écriture</td></tr>}
          </tbody>
        </Table>
      </Card.Body></Card>
    </>
  );
}
