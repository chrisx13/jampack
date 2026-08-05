import { useState } from 'react';
import { Card, Table, Spinner, Form, Row, Col, Button, Alert } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

export default function BankReconciliation() {
  const utils = trpc.useUtils();
  const can = useCan();
  const q = trpc.accounting.bankLines.useQuery();
  const reconcile = trpc.accounting.reconcile.useMutation({ onSuccess: () => utils.accounting.bankLines.invalidate() });
  const importStmt = trpc.accounting.importBankStatement.useMutation({ onSuccess: () => utils.accounting.bankLines.invalidate() });
  const [csv, setCsv] = useState('');
  const d = q.data;
  const rows = d?.lines ?? [];
  const editable = can('update', 'Accounting');

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setCsv(String(r.result ?? ''));
    r.readAsText(f);
  };

  const Stat = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
    <Col md={4}><Card className="h-100"><Card.Body>
      <div className="text-secondary small mb-1">{label}</div>
      <div className={`fs-5 fw-semibold ${tone ?? ''}`}>{euro.format(value)}</div>
    </Card.Body></Card></Col>
  );

  if (q.isLoading || !d) return <div className="text-center py-5"><Spinner /></div>;

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Rapprochement bancaire</h4><p className="text-secondary mb-0">Pointer les écritures du compte banque (512) au relevé</p></div>

      <Row className="g-3 mb-4">
        <Stat label="Solde comptable (512)" value={d.bookBalance} />
        <Stat label="Solde pointé (relevé)" value={d.reconciledBalance} tone="text-success" />
        <Stat label="Reste à pointer" value={d.unreconciled} tone={Math.abs(d.unreconciled) > 0.005 ? 'text-warning' : 'text-success'} />
      </Row>

      {editable && (
        <Card className="mb-3"><Card.Body>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
            <i className="bi bi-upload" />
            <span className="fw-semibold">Importer un relevé</span>
            <Form.Control type="file" accept=".csv,.txt" size="sm" style={{ maxWidth: 260 }} onChange={onFile} />
            <span className="text-secondary small">ou collez le CSV ci-dessous (date&nbsp;;&nbsp;libellé&nbsp;;&nbsp;montant)</span>
            <Button size="sm" variant="outline-primary" className="ms-auto" onClick={() => importStmt.mutate({ csv })} disabled={!csv.trim() || importStmt.isPending}>
              {importStmt.isPending ? <Spinner size="sm" /> : <><i className="bi bi-check2-all me-1" />Importer &amp; pointer</>}
            </Button>
          </div>
          <Form.Control as="textarea" rows={2} size="sm" placeholder="2026-08-04;Virement client Dupont;120,00" value={csv} onChange={(e) => setCsv(e.target.value)} />
          {importStmt.data && (
            <Alert variant={importStmt.data.unmatched.length ? 'warning' : 'success'} className="py-2 mt-2 mb-0 small">
              <strong>{importStmt.data.matched}/{importStmt.data.parsed}</strong> ligne(s) du relevé pointée(s) automatiquement.
              {importStmt.data.unmatched.length > 0 && <> {importStmt.data.unmatched.length} sans correspondance : {importStmt.data.unmatched.map((u) => `${u.label} (${euro.format(u.amount)})`).join(' · ')}.</>}
            </Alert>
          )}
        </Card.Body></Card>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3" style={{ width: 60 }}>Pointé</th><th scope="col">Date</th><th scope="col">Libellé</th><th scope="col">Réf.</th><th scope="col" className="text-end">Débit</th><th scope="col" className="text-end pe-3">Crédit</th></tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className={l.reconciled ? 'table-success' : ''}>
                  <td className="ps-3">
                    <Form.Check type="checkbox" checked={l.reconciled} disabled={!editable || reconcile.isPending} onChange={(e) => reconcile.mutate({ id: l.id, reconciled: e.target.checked })} />
                  </td>
                  <td className="text-secondary">{dfmt(l.date)}</td>
                  <td>{l.label ?? '—'}</td>
                  <td className="text-secondary">{l.reference ?? '—'}</td>
                  <td className="text-end">{l.debit ? euro.format(l.debit) : ''}</td>
                  <td className="text-end pe-3">{l.credit ? euro.format(l.credit) : ''}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Aucune écriture de banque (comptabilisez des règlements)</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
