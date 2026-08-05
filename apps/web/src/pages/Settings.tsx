import { useState } from 'react';
import { Row, Col, Card, Table, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };

export default function Settings() {
  const utils = trpc.useUtils();
  const can = useCan();
  const isAdmin = can('manage', 'all');
  const taxRates = trpc.catalog.taxRates.list.useQuery();
  const sequences = trpc.catalog.sequences.list.useQuery();

  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const addRate = trpc.catalog.taxRates.create.useMutation({ onSuccess: () => { setName(''); setRate(''); utils.catalog.taxRates.list.invalidate(); } });

  return (
    <>
      <h4 className="mb-4 fw-semibold">Paramètres</h4>
      <Row className="g-3">
        <Col lg={6}>
          <Card>
            <Card.Header className="fw-semibold">TVA</Card.Header>
            <Card.Body className="p-0">
              <Table className="mb-0 align-middle">
                <thead className="text-secondary small"><tr><th scope="col" className="ps-3">Libellé</th><th scope="col" className="text-end">Taux</th><th scope="col" className="text-end pe-3">Défaut</th></tr></thead>
                <tbody>
                  {taxRates.data?.map((t) => (
                    <tr key={t.id}>
                      <td className="ps-3">{t.name}</td>
                      <td className="text-end">{num(t.rate).toLocaleString('fr-FR')} %</td>
                      <td className="text-end pe-3">{t.isDefault && <Badge bg="primary-subtle" text="primary" className="fw-normal">défaut</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
            {isAdmin && (
              <Card.Footer className="bg-transparent">
                <Form className="d-flex gap-2 align-items-end" onSubmit={(e) => { e.preventDefault(); if (name.trim() && rate) addRate.mutate({ name: name.trim(), rate: Number(rate) }); }}>
                  <div className="flex-grow-1"><Form.Label className="small mb-1">Libellé</Form.Label><Form.Control size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="TVA 8,5 %" /></div>
                  <div style={{ width: 90 }}><Form.Label className="small mb-1">Taux %</Form.Label><Form.Control size="sm" type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
                  <Button type="submit" size="sm" disabled={addRate.isPending || !name.trim() || !rate}>{addRate.isPending ? <Spinner size="sm" /> : 'Ajouter'}</Button>
                </Form>
              </Card.Footer>
            )}
          </Card>
        </Col>

        <Col lg={6}>
          <Card>
            <Card.Header className="fw-semibold">Numérotation des pièces</Card.Header>
            <Card.Body className="p-0">
              <Table className="mb-0 align-middle">
                <thead className="text-secondary small"><tr><th scope="col" className="ps-3">Document</th><th scope="col">Préfixe</th><th scope="col" className="text-end pe-3">Prochain numéro</th></tr></thead>
                <tbody>
                  {sequences.data?.map((s) => (
                    <tr key={s.id}>
                      <td className="ps-3 text-capitalize">{s.docType}</td>
                      <td className="text-secondary">{s.prefix || '—'}</td>
                      <td className="text-end pe-3 fw-medium">{s.prefix}{String(s.nextValue).padStart(s.padding, '0')}</td>
                    </tr>
                  ))}
                  {sequences.data?.length === 0 && <tr><td colSpan={3} className="text-center text-secondary py-3">Sélectionnez une société</td></tr>}
                </tbody>
              </Table>
            </Card.Body>
            <Card.Footer className="bg-transparent text-secondary small">Numéros attribués de façon atomique à la création des pièces.</Card.Footer>
          </Card>
        </Col>
      </Row>
    </>
  );
}
