import { useState } from 'react';
import { Card, Table, Spinner, ButtonGroup, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const qfmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });

export default function StockValuation() {
  const [method, setMethod] = useState<'pmp' | 'fifo'>('pmp');
  const val = trpc.stock.valuation.useQuery({ method });
  const rows = val.data?.rows ?? [];

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-1 fw-semibold">Valorisation du stock</h4>
          <p className="text-secondary mb-0">{method === 'fifo' ? 'Méthode FIFO (premier entré, premier sorti)' : 'Méthode PMP (prix moyen pondéré des entrées)'}</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <ButtonGroup size="sm">
            <Button variant={method === 'pmp' ? 'primary' : 'outline-secondary'} onClick={() => setMethod('pmp')}>PMP</Button>
            <Button variant={method === 'fifo' ? 'primary' : 'outline-secondary'} onClick={() => setMethod('fifo')}>FIFO</Button>
          </ButtonGroup>
          {rows.length > 0 && <div className="text-end"><div className="text-secondary small">Valeur totale</div><div className="fs-5 fw-semibold">{euro.format(val.data?.total ?? 0)}</div></div>}
        </div>
      </div>

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="text-secondary small">
              <tr><th scope="col" className="ps-3">Article</th><th scope="col">Référence</th><th scope="col" className="text-end">Quantité</th><th scope="col" className="text-end">Coût unit.</th><th scope="col" className="text-end pe-3">Valeur</th></tr>
            </thead>
            <tbody>
              {val.isLoading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" /></td></tr>}
              {rows.map((r) => (
                <tr key={r.productId}>
                  <td className="ps-3 fw-medium">{r.productName}</td>
                  <td className="text-secondary">{r.reference ?? '—'}</td>
                  <td className="text-end">{qfmt(r.quantity)} <span className="text-secondary small">{r.unit}</span></td>
                  <td className="text-end text-secondary">{euro.format(r.pmp)}</td>
                  <td className="text-end pe-3 fw-semibold">{euro.format(r.value)}</td>
                </tr>
              ))}
              {val.isSuccess && rows.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Aucun stock valorisé</td></tr>}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}
