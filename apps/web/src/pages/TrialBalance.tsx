import { useState } from 'react';
import { Card, Table, Spinner, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export default function TrialBalance() {
  const bal = trpc.accounting.balance.useQuery();
  const utils = trpc.useUtils();
  const rows = bal.data?.rows ?? [];
  const equilibre = (bal.data?.totalDebit ?? 0) === (bal.data?.totalCredit ?? 0);
  const [exporting, setExporting] = useState(false);

  const exportFec = async () => {
    setExporting(true);
    try {
      const r = await utils.accounting.fec.fetch({});
      const blob = new Blob([r.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = r.filename; a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Balance générale</h4><p className="text-secondary mb-0">Totaux et soldes par compte</p></div>
        <Button variant="light" onClick={exportFec} disabled={exporting || rows.length === 0}><i className="bi bi-file-earmark-arrow-down me-1" />Exporter le FEC</Button>
      </div>
      <Card><Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="text-secondary small"><tr><th className="ps-3">Compte</th><th>Libellé</th><th className="text-end">Débit</th><th className="text-end">Crédit</th><th className="text-end pe-3">Solde</th></tr></thead>
          <tbody>
            {bal.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
            {rows.map((r) => (
              <tr key={r.accountId}>
                <td className="ps-3 fw-medium">{r.code}</td>
                <td>{r.name}</td>
                <td className="text-end text-secondary">{euro.format(r.debit)}</td>
                <td className="text-end text-secondary">{euro.format(r.credit)}</td>
                <td className={`text-end pe-3 fw-medium ${r.solde < 0 ? 'text-danger' : ''}`}>{euro.format(r.solde)}</td>
              </tr>
            ))}
            {bal.isSuccess && rows.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucune écriture</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr className="border-top fw-semibold">
              <td className="ps-3" colSpan={2}>Totaux {equilibre ? '✓' : '⚠️ déséquilibre'}</td>
              <td className="text-end">{euro.format(bal.data?.totalDebit ?? 0)}</td>
              <td className="text-end">{euro.format(bal.data?.totalCredit ?? 0)}</td>
              <td className="pe-3" />
            </tr></tfoot>
          )}
        </Table>
      </Card.Body></Card>
    </>
  );
}
