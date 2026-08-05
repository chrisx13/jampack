import { useState } from 'react';
import { Card, Table, Spinner, Form, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const val = (v: number) => (v ? euro.format(v) : '');

export default function Ledger() {
  const utils = trpc.useUtils();
  const accounts = trpc.accounting.accounts.list.useQuery();
  const [accountId, setAccountId] = useState('');
  const ledger = trpc.accounting.ledger.useQuery({ accountId }, { enabled: !!accountId });
  const d = ledger.data;

  const exportCsv = async () => {
    const r = await utils.accounting.exportLedger.fetch({ accountId });
    const url = URL.createObjectURL(new Blob([r.content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div><h4 className="mb-1 fw-semibold">Grand livre</h4><p className="text-secondary mb-0">Détail des mouvements par compte avec solde progressif</p></div>
        <div className="d-flex align-items-center gap-2">
          <Form.Select style={{ maxWidth: 340 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— Choisir un compte —</option>
            {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </Form.Select>
          {accountId && (d?.rows.length ?? 0) > 0 && <Button variant="light" title="Exporter en CSV" onClick={exportCsv}><i className="bi bi-filetype-csv me-1" />CSV</Button>}
        </div>
      </div>

      {!accountId && <Card><Card.Body className="text-center text-secondary py-5">Sélectionnez un compte pour afficher son grand livre.</Card.Body></Card>}

      {accountId && (
        <Card>
          <Card.Body className="p-0">
            <Table hover responsive className="mb-0 align-middle">
              <thead className="text-secondary small">
                <tr><th scope="col" className="ps-3">Date</th><th scope="col">Jal.</th><th scope="col">Réf.</th><th scope="col">Libellé</th><th scope="col">Let.</th><th scope="col" className="text-end">Débit</th><th scope="col" className="text-end">Crédit</th><th scope="col" className="text-end pe-3">Solde</th></tr>
              </thead>
              <tbody>
                {ledger.isLoading && <tr><td colSpan={8} className="text-center py-4"><Spinner size="sm" /></td></tr>}
                {d?.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="ps-3 text-secondary">{dfmt(r.date)}</td>
                    <td className="text-secondary">{r.journal}</td>
                    <td className="text-secondary">{r.reference ?? '—'}</td>
                    <td>{r.label ?? '—'}</td>
                    <td className="text-secondary">{r.letter ?? ''}</td>
                    <td className="text-end">{val(r.debit)}</td>
                    <td className="text-end">{val(r.credit)}</td>
                    <td className="text-end pe-3 fw-medium">{euro.format(r.solde)}</td>
                  </tr>
                ))}
                {d && d.rows.length === 0 && <tr><td colSpan={8} className="text-center text-secondary py-4">Aucun mouvement sur ce compte</td></tr>}
              </tbody>
              {d && d.rows.length > 0 && (
                <tfoot>
                  <tr className="fw-semibold border-top">
                    <td className="ps-3" colSpan={5}>Totaux</td>
                    <td className="text-end">{euro.format(d.totalDebit)}</td>
                    <td className="text-end">{euro.format(d.totalCredit)}</td>
                    <td className="text-end pe-3">{euro.format(d.solde)}</td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </Card.Body>
        </Card>
      )}
    </>
  );
}
