import { useState } from 'react';
import { Card, Spinner, Badge, ButtonGroup, Button } from 'react-bootstrap';
import { trpc } from '../trpc';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) : '—');
const dayKey = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : '');

const KIND: Record<string, { icon: string; color: string; label: string }> = {
  tache: { icon: 'bi-check2-square', color: 'primary', label: 'Tâche' },
  facture_client: { icon: 'bi-arrow-down-circle', color: 'success', label: 'Encaissement' },
  facture_fournisseur: { icon: 'bi-arrow-up-circle', color: 'danger', label: 'Décaissement' },
  livraison: { icon: 'bi-truck', color: 'info', label: 'Livraison' },
};

export default function Agenda() {
  const [days, setDays] = useState(30);
  const utils = trpc.useUtils();
  const q = trpc.analytics.agenda.useQuery({ days });
  const events = q.data?.events ?? [];

  const exportIcs = async () => {
    const r = await utils.analytics.agendaIcs.fetch({ days });
    const url = URL.createObjectURL(new Blob([r.content], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
  };

  // Regroupement par jour (l'ordre chronologique est garanti par le serveur).
  const groups: { day: string; items: typeof events }[] = [];
  for (const e of events) {
    const k = dayKey(e.date);
    const g = groups.find((x) => x.day === k);
    if (g) g.items.push(e); else groups.push({ day: k, items: [e] });
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-semibold">Agenda</h4>
          <p className="text-secondary mb-0">Échéances et tâches à venir {q.data && q.data.overdueCount > 0 && <Badge bg="danger-subtle" text="danger" className="fw-normal ms-1">{q.data.overdueCount} en retard</Badge>}</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <ButtonGroup size="sm">
            {[7, 30, 90].map((d) => <Button key={d} variant={days === d ? 'primary' : 'outline-secondary'} onClick={() => setDays(d)}>{d} j</Button>)}
          </ButtonGroup>
          <Button size="sm" variant="outline-secondary" onClick={exportIcs} disabled={events.length === 0} title="Exporter au format iCalendar (.ics)"><i className="bi bi-calendar-plus me-1" />ICS</Button>
        </div>
      </div>

      {q.isLoading && <div className="text-center py-5"><Spinner /></div>}
      {q.isSuccess && events.length === 0 && <Card><Card.Body className="text-center text-secondary py-5">Rien à l'agenda sur cette période 🎉</Card.Body></Card>}

      {groups.map((g) => (
        <div key={g.day} className="mb-3">
          <div className="fw-semibold text-secondary small text-uppercase mb-2">{dfmt(g.day)}</div>
          <Card>
            <Card.Body className="p-0">
              {g.items.map((e, i) => {
                const k = KIND[e.kind] ?? { icon: 'bi-dot', color: 'secondary', label: e.kind };
                return (
                  <div key={e.id} className={`d-flex align-items-center px-3 py-2 ${i > 0 ? 'border-top' : ''}`}>
                    <i className={`bi ${k.icon} text-${k.color} me-3 fs-5`} />
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-medium text-truncate">{e.label}</div>
                      <div className="small text-secondary">{k.label} · {e.party}</div>
                    </div>
                    {e.amount != null && <div className="text-end fw-semibold me-3">{euro.format(e.amount)}</div>}
                    {e.overdue && <Badge bg="danger-subtle" text="danger" className="fw-normal">en retard</Badge>}
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </div>
      ))}
    </>
  );
}
