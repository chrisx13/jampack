import { useMemo, useState } from 'react';
import { Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

export default function Lettrage() {
  const utils = trpc.useUtils();
  const accounts = trpc.accounting.accounts.list.useQuery();
  const [accountId, setAccountId] = useState('');
  const lines = trpc.accounting.accountLines.useQuery({ accountId }, { enabled: !!accountId });
  const letter = trpc.accounting.letter.useMutation();
  const unletter = trpc.accounting.unletter.useMutation();

  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const selected = (lines.data ?? []).filter((l) => sel.has(l.id));
  const selDebit = useMemo(() => Math.round(selected.reduce((s, l) => s + l.debit, 0) * 100) / 100, [selected]);
  const selCredit = useMemo(() => Math.round(selected.reduce((s, l) => s + l.credit, 0) * 100) / 100, [selected]);
  const balanced = selected.length >= 2 && selDebit === selCredit && selDebit > 0;

  const refresh = () => { utils.accounting.accountLines.invalidate({ accountId }); setSel(new Set()); };
  const doLetter = async () => { await letter.mutateAsync({ lineIds: [...sel] }); refresh(); };
  const doUnletter = async (code: string) => { await unletter.mutateAsync({ letter: code }); refresh(); };

  // comptes de tiers (classes 40/41) en tête
  const accs = (accounts.data ?? []).filter((a) => a.code.startsWith('41') || a.code.startsWith('40'));

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Lettrage</h4><p className="text-secondary mb-0">Rapprochement débit / crédit sur un compte de tiers</p></div>
        <Form.Select style={{ maxWidth: 320 }} value={accountId} onChange={(e) => { setAccountId(e.target.value); setSel(new Set()); }}>
          <option value="">— Choisir un compte —</option>
          {accs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          {(accounts.data ?? []).filter((a) => !a.code.startsWith('41') && !a.code.startsWith('40')).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </Form.Select>
      </div>

      {!accountId && <p className="text-secondary">Sélectionnez un compte (ex. 411000 Clients, 401000 Fournisseurs).</p>}

      {accountId && (
        <>
          {balanced && (
            <div className="mb-3 d-flex align-items-center gap-3">
              <Button size="sm" onClick={doLetter} disabled={letter.isPending}><i className="bi bi-link-45deg me-1" />Lettrer {selected.length} lignes</Button>
              <span className="small text-success"><i className="bi bi-check2 me-1" />Équilibré ({euro.format(selDebit)})</span>
            </div>
          )}
          {sel.size >= 2 && !balanced && <div className="mb-3 small text-warning"><i className="bi bi-exclamation-triangle me-1" />Sélection non équilibrée (D {euro.format(selDebit)} / C {euro.format(selCredit)})</div>}
          {(letter.error || unletter.error) && <div className="text-danger small mb-2">{(letter.error || unletter.error)?.message}</div>}

          <Card><Card.Body className="p-0">
            <Table hover responsive className="mb-0 align-middle">
              <thead className="text-secondary small"><tr><th style={{ width: 40 }} /><th className="ps-1">Date</th><th>Pièce</th><th>Libellé</th><th className="text-end">Débit</th><th className="text-end">Crédit</th><th className="pe-3">Lettrage</th></tr></thead>
              <tbody>
                {lines.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
                {lines.data?.map((l) => (
                  <tr key={l.id} className={l.letter ? 'text-secondary' : ''}>
                    <td className="text-center">{!l.letter && <Form.Check checked={sel.has(l.id)} onChange={() => toggle(l.id)} />}</td>
                    <td className="ps-1">{dfmt(l.date)}</td>
                    <td>{l.reference ?? '—'}</td>
                    <td>{l.label}</td>
                    <td className="text-end">{l.debit ? euro.format(l.debit) : ''}</td>
                    <td className="text-end">{l.credit ? euro.format(l.credit) : ''}</td>
                    <td className="pe-3">{l.letter && <Badge bg="success-subtle" text="success" className="fw-normal" role="button" title="Cliquer pour délettrer" onClick={() => doUnletter(l.letter!)}>{l.letter} <i className="bi bi-x" /></Badge>}</td>
                  </tr>
                ))}
                {lines.isSuccess && lines.data.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucune ligne sur ce compte</td></tr>}
              </tbody>
            </Table>
          </Card.Body></Card>
        </>
      )}
    </>
  );
}
