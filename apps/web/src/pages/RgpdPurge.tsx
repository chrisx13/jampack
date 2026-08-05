import { Card, Table, Spinner, Button, Alert } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');

export default function RgpdPurge() {
  const utils = trpc.useUtils();
  const can = useCan();
  const q = trpc.crm.companies.purgeCandidates.useQuery();
  const anonymize = trpc.crm.companies.anonymize.useMutation({ onSuccess: () => { utils.crm.companies.purgeCandidates.invalidate(); utils.crm.companies.list.invalidate(); } });
  const rows = q.data ?? [];
  const editable = can('delete', 'Company');

  return (
    <>
      <div className="mb-4"><h4 className="mb-1 fw-semibold">Purge RGPD</h4><p className="text-secondary mb-0">Tiers sans activité depuis plus de 3 ans (durée de conservation en base active — réf. CNIL)</p></div>

      <Alert variant="light" className="border small">
        <i className="bi bi-info-circle me-1" />
        L'anonymisation efface l'identité (nom, SIREN/SIRET/TVA) et les contacts, mais <strong>conserve les pièces
        comptables</strong> (réserve légale 10 ans). Vérifiez au cas par cas avant d'anonymiser.
      </Alert>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Tiers</th><th scope="col">Dernière activité</th><th scope="col">Motif</th><th scope="col" className="text-end pe-3" /></tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={4} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="ps-3 fw-medium">{c.name}</td>
                  <td className="text-secondary">{dfmt(c.lastActivity)}</td>
                  <td className="text-secondary small">{c.reason}</td>
                  <td className="text-end pe-3">
                    {editable && <Button variant="outline-warning" size="sm" onClick={() => anonymize.mutate({ id: c.id })} disabled={anonymize.isPending}><i className="bi bi-person-x me-1" />Anonymiser</Button>}
                  </td>
                </tr>
              ))}
              {q.isSuccess && rows.length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-4">Aucun tiers à purger</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
