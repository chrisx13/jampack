import { Card, Table, Spinner, Button, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const LABELS = ['Aucune', 'Relance 1', 'Relance 2', 'Mise en demeure'];

export default function Reminders() {
  const utils = trpc.useUtils();
  const can = useCan();
  const q = trpc.payments.reminders.useQuery();
  const record = trpc.payments.recordReminder.useMutation({ onSuccess: () => { utils.payments.reminders.invalidate(); utils.invoices.list.invalidate(); } });
  const rows = q.data ?? [];
  const editable = can('update', 'Payment');

  const letter = async (id: string) => {
    const r = await utils.payments.reminderLetter.fetch({ id });
    const url = URL.createObjectURL(new Blob([r.content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Relances clients</h4><p className="text-secondary mb-0">Factures échues non soldées — relance progressive (rappel → ferme → mise en demeure)</p></div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Facture</th><th scope="col">Client</th><th scope="col">Échéance</th><th scope="col" className="text-end">Reste dû</th><th scope="col">Niveau</th><th scope="col">Dernière relance</th><th scope="col" className="text-end pe-3">Actions</th></tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="ps-3 fw-medium">{r.number ?? '—'}</td>
                  <td>{r.company?.name ?? '—'}</td>
                  <td className="text-secondary">{dfmt(r.dueDate)}</td>
                  <td className="text-end fw-semibold">{euro.format(r.remaining)}</td>
                  <td>{r.reminderLevel > 0 ? <Badge bg={r.reminderLevel >= 3 ? 'danger-subtle' : 'warning-subtle'} text={r.reminderLevel >= 3 ? 'danger' : 'warning'} className="fw-normal">{LABELS[r.reminderLevel]}</Badge> : <span className="text-secondary">—</span>}</td>
                  <td className="text-secondary">{dfmt(r.lastReminderAt)}</td>
                  <td className="text-end pe-3">
                    <Button variant="light" size="sm" className="me-1" title="Télécharger la lettre de relance" onClick={() => letter(r.id)}><i className="bi bi-file-earmark-text" /></Button>
                    {editable && r.reminderLevel < 3 && <Button variant="outline-warning" size="sm" onClick={() => record.mutate({ id: r.id })} disabled={record.isPending}><i className="bi bi-send me-1" />Relancer</Button>}
                  </td>
                </tr>
              ))}
              {q.isSuccess && rows.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">Aucune facture échue à relancer</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
