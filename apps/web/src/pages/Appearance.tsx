import { useEffect, useState } from 'react';
import { Card, Button, Form, Row, Col, Badge, Alert, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import { applyTheme, buildThemeCss, exportThemeJson, importTheme, DEFAULT_THEME, type ThemeColors } from '../theme/applyTheme';

const FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'primary', label: 'Primaire' },
  { key: 'success', label: 'Succès' },
  { key: 'info', label: 'Info' },
  { key: 'warning', label: 'Avertissement' },
  { key: 'danger', label: 'Danger' },
];

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Appearance() {
  const utils = trpc.useUtils();
  const saved = trpc.settings.getTheme.useQuery();
  const can = useCan();
  const editable = can('manage', 'all');

  const [theme, setTheme] = useState<ThemeColors>(DEFAULT_THEME);
  const [importText, setImportText] = useState('');

  // Initialise depuis le thème enregistré.
  useEffect(() => { if (saved.data) setTheme(saved.data); }, [saved.data]);
  // Aperçu en direct.
  useEffect(() => { applyTheme(theme); }, [theme]);
  // Au démontage, on rétablit le thème enregistré (annule l'aperçu non sauvegardé).
  useEffect(() => () => { if (saved.data) applyTheme(saved.data); }, [saved.data]);

  const save = trpc.settings.setTheme.useMutation({
    onSuccess: (data) => { applyTheme(data); utils.settings.getTheme.invalidate(); },
  });

  const set = (key: keyof ThemeColors, value: string) => setTheme((t) => ({ ...t, [key]: value }));
  const dirty = saved.data ? FIELDS.some((f) => saved.data![f.key] !== theme[f.key]) : false;

  if (saved.isLoading) return <div className="text-center py-5"><Spinner /></div>;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-1 fw-semibold">Apparence — Look &amp; feel</h4>
          <p className="text-secondary mb-0">Couleurs de marque du compte (visibles par tous les utilisateurs).</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="light" onClick={() => setTheme(saved.data ?? DEFAULT_THEME)} disabled={!dirty}>Annuler</Button>
          <Button variant="outline-secondary" onClick={() => setTheme(DEFAULT_THEME)}>Réinitialiser</Button>
          {editable && (
            <Button onClick={() => save.mutate(theme)} disabled={!dirty || save.isPending}>
              {save.isPending ? <Spinner size="sm" /> : <><i className="bi bi-check2 me-1" />Enregistrer</>}
            </Button>
          )}
        </div>
      </div>

      {!editable && <Alert variant="warning" className="py-2">Vous pouvez prévisualiser, mais seule l'administration peut enregistrer le thème.</Alert>}

      <Row className="g-3">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header className="fw-semibold">Couleurs</Card.Header>
            <Card.Body>
              {FIELDS.map((f) => (
                <div key={f.key} className="d-flex align-items-center gap-3 mb-3">
                  <Form.Control type="color" value={theme[f.key]} onChange={(e) => set(f.key, e.target.value)} style={{ width: 52, height: 40, padding: 4 }} />
                  <div className="flex-grow-1">
                    <div className="fw-medium">{f.label}</div>
                    <Form.Control size="sm" value={theme[f.key]} onChange={(e) => set(f.key, e.target.value)} style={{ maxWidth: 130 }} />
                  </div>
                  <Badge bg={f.key} className="fw-normal">{f.key}</Badge>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="mb-3">
            <Card.Header className="fw-semibold">Aperçu</Card.Header>
            <Card.Body className="d-flex flex-column gap-3">
              <div className="d-flex flex-wrap gap-2">
                {FIELDS.map((f) => <Button key={f.key} variant={f.key}>{f.label}</Button>)}
              </div>
              <div className="d-flex flex-wrap gap-2">
                {FIELDS.map((f) => <Badge key={f.key} bg={`${f.key}-subtle`} text={f.key} className="fw-normal">{f.label}</Badge>)}
              </div>
              <Alert variant="primary" className="mb-0 py-2">Exemple de bandeau à la couleur primaire.</Alert>
              <a href="#!" onClick={(e) => e.preventDefault()}>Exemple de lien</a>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className="fw-semibold">Partage du thème (import / export)</Card.Header>
            <Card.Body>
              <div className="d-flex gap-2 mb-3">
                <Button variant="light" onClick={() => download('jampack-theme.json', exportThemeJson(theme), 'application/json')}>
                  <i className="bi bi-download me-1" />Exporter JSON
                </Button>
                <Button variant="light" onClick={() => download('jampack-theme.css', buildThemeCss(theme), 'text/css')}>
                  <i className="bi bi-filetype-css me-1" />Exporter CSS
                </Button>
              </div>
              <Form.Label className="small text-secondary">Importer (coller un thème JSON ou CSS)</Form.Label>
              <Form.Control as="textarea" rows={4} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{ "primary": "#007D88", ... }  ou  :root{ --bs-primary:#007D88; ... }' />
              <div className="mt-2">
                <Button variant="outline-secondary" size="sm" disabled={!importText.trim()} onClick={() => { setTheme(importTheme(importText)); setImportText(''); }}>
                  <i className="bi bi-upload me-1" />Appliquer l'import (aperçu)
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      {save.error && <div className="text-danger small mt-2">{save.error.message}</div>}
    </>
  );
}
