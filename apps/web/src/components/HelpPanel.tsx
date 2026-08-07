import { useMemo, useState } from 'react';
import { Offcanvas, Form, Button, Badge, Spinner, Alert, Accordion } from 'react-bootstrap';
import { trpc } from '../trpc';

// Aide à l'utilisation : bouton flottant + panneau. NIVEAU 1 gratuit (recherche locale + scénarios
// pas à pas). NIVEAU 2 (option) : assistant IA (Claude), 1 crédit, ancré sur l'aide.

type Article = { id: string; title: string; category: string; screen: string; summary: string; steps: string[]; related?: string[] };

function Steps({ a }: { a: Article }) {
  return (
    <>
      <div className="small text-secondary mb-1"><i className="bi bi-geo-alt me-1" />{a.screen}</div>
      <p className="small mb-2">{a.summary}</p>
      <ol className="small mb-0 ps-3">{a.steps.map((s, i) => <li key={i} className="mb-1">{s}</li>)}</ol>
    </>
  );
}

export default function HelpPanel() {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState('');
  const [question, setQuestion] = useState('');

  const topics = trpc.help.topics.useQuery(undefined, { enabled: show });
  const search = trpc.help.search.useQuery({ query }, { enabled: show && query.trim().length > 1 });
  const aiStatus = trpc.help.aiStatus.useQuery(undefined, { enabled: show });
  const ask = trpc.help.ask.useMutation();

  const articles = (search.data?.results ?? (query.trim().length > 1 ? [] : topics.data?.articles ?? [])) as Article[];
  const byCategory = useMemo(() => {
    const cats = (topics.data?.categories ?? []) as string[];
    return cats.map((c) => ({ c, items: articles.filter((a) => a.category === c) })).filter((g) => g.items.length);
  }, [articles, topics.data]);

  const aiEnabled = !!aiStatus.data?.enabled;
  const balance = aiStatus.data?.balance ?? 0;

  return (
    <>
      <Button
        variant="primary" className="rounded-circle shadow position-fixed d-flex align-items-center justify-content-center"
        style={{ bottom: 20, right: 20, width: 52, height: 52, zIndex: 1030 }}
        title="Aide" aria-label="Ouvrir l'aide" onClick={() => setShow(true)}
      ><i className="bi bi-question-lg fs-4" /></Button>

      <Offcanvas show={show} onHide={() => setShow(false)} placement="end" style={{ width: 'min(460px, 100vw)' }}>
        <Offcanvas.Header closeButton><Offcanvas.Title><i className="bi bi-life-preserver me-2" />Aide</Offcanvas.Title></Offcanvas.Header>
        <Offcanvas.Body>
          <Form.Group className="mb-3">
            <div className="position-relative">
              <i className="bi bi-search position-absolute text-secondary" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
              <Form.Control className="ps-4" placeholder="Rechercher (ex. « créer un devis »)…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Form.Text className="text-secondary">Recherche <strong>gratuite</strong> dans les guides pas à pas.</Form.Text>
          </Form.Group>

          {(search.isLoading || topics.isLoading) && <div className="text-center py-3"><Spinner size="sm" /></div>}
          {query.trim().length > 1 && search.isSuccess && articles.length === 0 && (
            <Alert variant="light" className="border small">Aucun guide ne correspond. Reformulez, ou demandez à l'assistant IA ci-dessous.</Alert>
          )}

          {query.trim().length > 1 ? (
            <Accordion alwaysOpen className="mb-3">
              {articles.map((a, i) => (
                <Accordion.Item eventKey={String(i)} key={a.id}>
                  <Accordion.Header><span className="fw-medium">{a.title}</span><Badge bg="light" text="dark" className="border fw-normal ms-2">{a.category}</Badge></Accordion.Header>
                  <Accordion.Body><Steps a={a} /></Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          ) : (
            byCategory.map((g) => (
              <div key={g.c} className="mb-3">
                <div className="text-secondary small text-uppercase mb-1">{g.c}</div>
                <Accordion>
                  {g.items.map((a, i) => (
                    <Accordion.Item eventKey={String(i)} key={a.id}>
                      <Accordion.Header>{a.title}</Accordion.Header>
                      <Accordion.Body><Steps a={a} /></Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>
            ))
          )}

          <hr />
          <div className="mb-2 d-flex align-items-center justify-content-between">
            <span className="fw-semibold"><i className="bi bi-robot me-1" />Assistant IA</span>
            {aiEnabled
              ? <Badge bg="light" text="dark" className="border fw-normal">{balance} crédit(s)</Badge>
              : <Badge bg="secondary-subtle" text="secondary" className="fw-normal">indisponible</Badge>}
          </div>
          {aiEnabled ? (
            <>
              <Form.Control as="textarea" rows={2} placeholder="Posez votre question…" value={question} onChange={(e) => setQuestion(e.target.value)} className="mb-2" />
              <Button size="sm" disabled={ask.isPending || balance <= 0 || question.trim().length < 3} onClick={() => ask.mutate({ question: question.trim() })}>
                {ask.isPending ? <Spinner size="sm" /> : <><i className="bi bi-send me-1" />Demander (1 crédit)</>}
              </Button>
              {balance <= 0 && <div className="small text-secondary mt-1">Crédits épuisés — la recherche gratuite reste disponible.</div>}
              {ask.isError && <Alert variant="danger" className="py-2 small mt-2 mb-0">{ask.error.message}</Alert>}
              {ask.data && (
                <Alert variant="light" className="border mt-2 mb-0">
                  <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{ask.data.answer}</div>
                  {ask.data.sources.length > 0 && <div className="small text-secondary mt-2">Sources : {ask.data.sources.map((s: { title: string }) => s.title).join(', ')}.</div>}
                </Alert>
              )}
            </>
          ) : (
            <p className="small text-secondary mb-0">L'assistant IA (Claude) est désactivé sur cette instance. La recherche d'aide ci-dessus reste entièrement gratuite.</p>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
