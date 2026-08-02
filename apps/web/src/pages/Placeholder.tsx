import { Card } from 'react-bootstrap';

export default function Placeholder({ title }: { title: string }) {
  return (
    <>
      <h4 className="mb-4 fw-semibold">{title}</h4>
      <Card>
        <Card.Body className="text-center text-secondary py-5">
          <i className="bi bi-cone-striped fs-1 d-block mb-2 text-primary" />
          Module « {title} » — à venir dans une prochaine phase.
        </Card.Body>
      </Card>
    </>
  );
}
