import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { trpc } from '../trpc';
import { useCan } from '../ability';
import type { NoteColor } from '@jampack/domain';

/**
 * Couche de pense-bêtes partagés, ancrée à une vue (viewKey).
 * - visibles par tous les utilisateurs ayant le droit `read Note` ;
 * - éditables avec historisation (chaque enregistrement crée une révision) ;
 * - déplaçables (drag) pour ne pas masquer les données de la vue ;
 * - plusieurs notes par vue, plusieurs couleurs.
 */

const COLORS: Record<string, { bg: string; border: string; label: string }> = {
  amber: { bg: '#FEF3C7', border: '#FCD34D', label: 'Ambre' },
  blue: { bg: '#DBEAFE', border: '#93C5FD', label: 'Bleu' },
  green: { bg: '#DCFCE7', border: '#86EFAC', label: 'Vert' },
  pink: { bg: '#FCE7F3', border: '#F9A8D4', label: 'Rose' },
  slate: { bg: '#E2E8F0', border: '#CBD5E1', label: 'Ardoise' },
};
const COLOR_KEYS = Object.keys(COLORS);
const dtf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

type Note = { id: string; content: string; color: string; x: number; y: number; createdBy?: { name?: string | null; email?: string } | null; _count?: { revisions: number } };

function HistoryModal({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const hist = trpc.notes.history.useQuery({ id: noteId });
  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>Historique de la note</Modal.Title></Modal.Header>
      <Modal.Body>
        {hist.isLoading && <div className="text-secondary small">Chargement…</div>}
        {hist.data?.length === 0 && <div className="text-secondary small">Aucune modification enregistrée.</div>}
        <div className="d-flex flex-column gap-2">
          {hist.data?.map((r) => (
            <div key={r.id} className="border rounded-3 p-2">
              <div className="small text-secondary mb-1">{dtf.format(new Date(r.createdAt as unknown as string))} · {r.author?.name ?? r.author?.email ?? '—'}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{r.content}</div>
            </div>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
}

function StickyNote({ note, editable, deletable, onHistory }: { note: Note; editable: boolean; deletable: boolean; onHistory: (id: string) => void }) {
  const utils = trpc.useUtils();
  const invalidate = () => utils.notes.list.invalidate();
  const edit = trpc.notes.edit.useMutation({ onSuccess: invalidate });
  const move = trpc.notes.move.useMutation({ onSuccess: invalidate });
  const setColor = trpc.notes.setColor.useMutation({ onSuccess: invalidate });
  const remove = trpc.notes.remove.useMutation({ onSuccess: invalidate });

  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [text, setText] = useState(note.content);
  const [showColors, setShowColors] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => { setPos({ x: note.x, y: note.y }); }, [note.x, note.y]);
  useEffect(() => { setText(note.content); }, [note.content]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({ x: Math.max(0, e.clientX - drag.current.dx), y: Math.max(0, e.clientY - drag.current.dy) });
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (pos.x !== note.x || pos.y !== note.y) move.mutate({ id: note.id, x: Math.round(pos.x), y: Math.round(pos.y) });
  };
  const saveText = () => { if (text !== note.content) edit.mutate({ id: note.id, content: text }); };

  const c = COLORS[note.color] ?? COLORS.amber;
  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, width: 220, zIndex: 5, pointerEvents: 'auto' }}>
      <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, boxShadow: '0 6px 16px rgba(15,23,42,.18)', color: '#1f2937' }}>
        <div
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', cursor: editable ? 'grab' : 'default', borderBottom: `1px solid ${c.border}` }}
        >
          <i className="bi bi-grip-horizontal" style={{ opacity: 0.5 }} />
          <div className="d-flex align-items-center gap-1">
            <button type="button" title="Couleur" className="btn btn-sm p-0 border-0 bg-transparent" style={{ lineHeight: 1 }} onClick={() => setShowColors((s) => !s)} disabled={!editable}><i className="bi bi-palette" /></button>
            {note._count && note._count.revisions > 0 && (
              <button type="button" title="Historique" className="btn btn-sm p-0 border-0 bg-transparent" style={{ lineHeight: 1 }} onClick={() => onHistory(note.id)}><i className="bi bi-clock-history" /></button>
            )}
            {deletable && <button type="button" title="Supprimer" className="btn btn-sm p-0 border-0 bg-transparent text-danger" style={{ lineHeight: 1 }} onClick={() => remove.mutate({ id: note.id })}><i className="bi bi-trash" /></button>}
          </div>
        </div>
        {showColors && (
          <div className="d-flex gap-1 px-2 py-1" style={{ borderBottom: `1px solid ${c.border}` }}>
            {COLOR_KEYS.map((k) => (
              <button key={k} type="button" title={COLORS[k].label} onClick={() => { setColor.mutate({ id: note.id, color: k as NoteColor }); setShowColors(false); }}
                style={{ width: 16, height: 16, borderRadius: '50%', background: COLORS[k].bg, border: `2px solid ${COLORS[k].border}`, cursor: 'pointer' }} />
            ))}
          </div>
        )}
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} onBlur={saveText} readOnly={!editable}
          placeholder="Écrire une note…" rows={4}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', resize: 'vertical', padding: '8px 10px', fontSize: '.85rem', color: 'inherit' }}
        />
      </div>
    </div>
  );
}

export default function NotesOverlay({ viewKey }: { viewKey: string }) {
  const can = useCan();
  const canRead = can('read', 'Note');
  const canCreate = can('create', 'Note');
  const canUpdate = can('update', 'Note');
  const canDelete = can('delete', 'Note');
  const utils = trpc.useUtils();
  const list = trpc.notes.list.useQuery({ viewKey }, { enabled: canRead });
  const create = trpc.notes.create.useMutation({ onSuccess: () => utils.notes.list.invalidate() });
  const [hidden, setHidden] = useState(false);
  const [history, setHistory] = useState<string | null>(null);

  if (!canRead) return null;
  const notes = (list.data ?? []) as Note[];

  const addNote = () => {
    // Léger décalage en cascade pour éviter la superposition des nouvelles notes.
    const offset = (notes.length % 5) * 18;
    create.mutate({ viewKey, content: '', color: 'amber', x: 40 + offset, y: 80 + offset });
  };

  return (
    <>
      {/* Couche transparente : n'intercepte pas les clics (pointer-events none), seules les notes sont actives. */}
      {!hidden && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {notes.map((n) => (
            <StickyNote key={n.id} note={n} editable={canUpdate} deletable={canDelete} onHistory={setHistory} />
          ))}
        </div>
      )}

      {/* Pastille de contrôle (afficher/masquer, ajouter) — discrète, en bas à droite. */}
      <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 6, display: 'flex', gap: 8 }}>
        {notes.length > 0 && (
          <Button variant="light" size="sm" className="shadow-sm" title={hidden ? 'Afficher les notes' : 'Masquer les notes'} onClick={() => setHidden((h) => !h)}>
            <i className={`bi ${hidden ? 'bi-sticky' : 'bi-eye-slash'} me-1`} />{notes.length}
          </Button>
        )}
        {canCreate && (
          <Button variant="warning" size="sm" className="shadow-sm" title="Ajouter une note" onClick={addNote} disabled={create.isPending}>
            <i className="bi bi-sticky me-1" />Note
          </Button>
        )}
      </div>

      {history && <HistoryModal noteId={history} onClose={() => setHistory(null)} />}
    </>
  );
}
