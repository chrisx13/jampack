import { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Card, Badge, Spinner } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';

const num = (v: unknown) => {
  const n = Number(v as never);
  return Number.isFinite(n) ? n : 0;
};
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function Pipeline() {
  const utils = trpc.useUtils();
  const stages = trpc.crm.stages.list.useQuery();
  const opps = trpc.crm.opportunities.list.useQuery();
  const can = useCan();
  const canMove = can('update', 'Opportunity');

  const move = trpc.crm.opportunities.move.useMutation({
    onSettled: () => utils.crm.opportunities.list.invalidate(),
  });

  const byStage = useMemo(() => {
    const m: Record<string, NonNullable<typeof opps.data>> = {};
    (stages.data ?? []).forEach((s) => (m[s.id] = []));
    (opps.data ?? []).forEach((o) => (m[o.stageId] ??= []).push(o));
    return m;
  }, [stages.data, opps.data]);

  const stageTotal = (id: string) => (byStage[id] ?? []).reduce((s, o) => s + num(o.amount), 0);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    move.mutate({ id: r.draggableId, stageId: r.destination.droppableId });
  };

  if (stages.isLoading || opps.isLoading) return <div className="text-center py-5"><Spinner /></div>;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-1 fw-semibold">Pipeline</h4>
          <p className="text-secondary mb-0">Glissez une opportunité pour la faire avancer</p>
        </div>
        {move.isPending && <Spinner size="sm" />}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="d-flex gap-3 pb-2" style={{ overflowX: 'auto' }}>
          {stages.data?.map((stage) => {
            const items = byStage[stage.id] ?? [];
            return (
              <div key={stage.id} style={{ minWidth: 288, width: 288 }} className="flex-shrink-0">
                <div className="d-flex align-items-center justify-content-between px-1 mb-2">
                  <span className="fw-semibold">{stage.name}</span>
                  <Badge bg="secondary-subtle" text="secondary">{items.length}</Badge>
                </div>
                <div className="text-secondary small px-1 mb-2">{euro.format(stageTotal(stage.id))}</div>
                <Droppable droppableId={stage.id} isDropDisabled={!canMove}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="rounded-3 p-2"
                      style={{ minHeight: 120, background: snapshot.isDraggingOver ? 'rgba(var(--bs-primary-rgb),.08)' : 'var(--bs-tertiary-bg)' }}
                    >
                      {items.map((o, i) => (
                        <Draggable key={o.id} draggableId={o.id} index={i} isDragDisabled={!canMove}>
                          {(p, snap) => (
                            <Card
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              className={`mb-2 ${snap.isDragging ? 'shadow' : ''}`}
                              style={{ ...p.draggableProps.style, cursor: canMove ? 'grab' : 'default' }}
                            >
                              <Card.Body className="p-2">
                                <div className="fw-medium small">{o.title}</div>
                                <div className="text-secondary" style={{ fontSize: '.8rem' }}>{o.company?.name ?? '—'}</div>
                                {o.amount != null && (
                                  <Badge bg="primary-subtle" text="primary" className="mt-1 fw-normal">{euro.format(num(o.amount))}</Badge>
                                )}
                              </Card.Body>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {items.length === 0 && <div className="text-center text-secondary small py-3">—</div>}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {!canMove && (
        <p className="text-secondary small mt-3">
          <i className="bi bi-lock me-1" />Lecture seule : votre rôle ne permet pas de déplacer les opportunités.
        </p>
      )}
    </>
  );
}
