import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;
const createdIds: string[] = [];

beforeAll(async () => { C = await demoCaller(); caller = C.caller; });
afterAll(async () => { await C.prisma.viewNote.deleteMany({ where: { id: { in: createdIds } } }); });

describe('Notes de vue — partage, historisation, déplacement', () => {
  it('création → visible dans la liste de la vue', async () => {
    const note = await caller.notes.create({ viewKey: 'invoices-test', content: 'Penser à relancer Dupont', color: 'amber', x: 40, y: 60 });
    createdIds.push(note.id);
    const list = await caller.notes.list({ viewKey: 'invoices-test' });
    expect(list.some((n: { id: string }) => n.id === note.id)).toBe(true);
    expect(note.createdBy?.email).toBe('compta@demo.fr');
  });

  it('édition → historisation (une révision par modification de contenu)', async () => {
    const note = await caller.notes.create({ viewKey: 'notes-hist', content: 'v1', color: 'blue', x: 0, y: 0 });
    createdIds.push(note.id);
    await caller.notes.edit({ id: note.id, content: 'v2' });
    await caller.notes.edit({ id: note.id, content: 'v3' });
    await caller.notes.edit({ id: note.id, content: 'v3' }); // no-op : contenu identique → pas de révision
    const hist = await caller.notes.history({ id: note.id });
    expect(hist.map((h: { content: string }) => h.content)).toEqual(['v3', 'v2', 'v1']); // récent → ancien
    expect(hist[0].author?.email).toBe('compta@demo.fr');
  });

  it('déplacement → position persistée, sans nouvelle révision', async () => {
    const note = await caller.notes.create({ viewKey: 'notes-move', content: 'drag', x: 10, y: 10 });
    createdIds.push(note.id);
    await caller.notes.move({ id: note.id, x: 300, y: 200 });
    const [moved] = await caller.notes.list({ viewKey: 'notes-move' });
    expect([moved.x, moved.y]).toEqual([300, 200]);
    const hist = await caller.notes.history({ id: note.id });
    expect(hist).toHaveLength(1); // seule la création (contenu initial) a historisé
  });

  it('suppression → retirée de la vue', async () => {
    const note = await caller.notes.create({ viewKey: 'notes-del', content: 'x' });
    await caller.notes.remove({ id: note.id });
    const list = await caller.notes.list({ viewKey: 'notes-del' });
    expect(list.some((n: { id: string }) => n.id === note.id)).toBe(false);
  });
});
