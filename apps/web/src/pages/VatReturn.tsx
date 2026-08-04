import { Card, Spinner, Button } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export default function VatReturn() {
  const utils = trpc.useUtils();
  const can = useCan();
  const tva = trpc.accounting.vatReturn.useQuery({});
  const close = trpc.accounting.closeVat.useMutation();
  const d = tva.data;

  const onClose = async () => {
    const r = await close.mutateAsync({});
    utils.accounting.vatReturn.invalidate(); utils.accounting.balance.invalidate(); utils.accounting.entries.list.invalidate();
    alert(`Écriture de clôture générée (journal OD). Net : ${euro.format(Math.abs(r.net))} ${r.net >= 0 ? 'à décaisser' : 'de crédit de TVA'}.`);
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div><h4 className="mb-1 fw-semibold">Déclaration de TVA (CA3)</h4><p className="text-secondary mb-0">TVA collectée − TVA déductible</p></div>
        {can('manage', 'all') && d && (d.collectee > 0 || d.deductible > 0) && (
          <Button variant="outline-primary" onClick={onClose} disabled={close.isPending}><i className="bi bi-journal-check me-1" />Générer l'écriture de clôture</Button>
        )}
      </div>

      {tva.isLoading && <Spinner size="sm" />}
      {d && (
        <div className="row g-3" style={{ maxWidth: 720 }}>
          <div className="col-md-6">
            <Card><Card.Body>
              <div className="text-secondary small">TVA collectée (44571)</div>
              <div className="fs-4 fw-semibold">{euro.format(d.collectee)}</div>
            </Card.Body></Card>
          </div>
          <div className="col-md-6">
            <Card><Card.Body>
              <div className="text-secondary small">TVA déductible (44566)</div>
              <div className="fs-4 fw-semibold">{euro.format(d.deductible)}</div>
            </Card.Body></Card>
          </div>
          <div className="col-12">
            <Card border={d.aPayer > 0 ? 'danger' : 'success'}>
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-secondary small">{d.aPayer > 0 ? 'TVA à décaisser' : 'Crédit de TVA à reporter'}</div>
                  <div className="fs-3 fw-bold">{euro.format(d.aPayer > 0 ? d.aPayer : d.creditTva)}</div>
                </div>
                <i className={`bi ${d.aPayer > 0 ? 'bi-arrow-up-circle text-danger' : 'bi-arrow-down-circle text-success'} fs-1`} />
              </Card.Body>
            </Card>
          </div>
          <div className="col-12"><p className="text-secondary small mb-0">Calcul sur l’ensemble des écritures de la société. Le lettrage, la déclaration périodique (mensuelle/trimestrielle) et l’écriture de clôture de TVA seront ajoutés ultérieurement.</p></div>
        </div>
      )}
    </>
  );
}
