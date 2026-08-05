import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { trpc } from './trpc';
import { useCan } from './ability';
import { authEnabled } from './auth';
import { EXPENSE_CATEGORIES } from '@jampack/domain';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };

function LogoutButton() {
  const auth = useAuth();
  return (
    <button className="btn btn-sm btn-outline-light border-0" onClick={() => auth.signoutRedirect()} aria-label="Se déconnecter">
      <i className="bi bi-box-arrow-right" aria-hidden="true" />
    </button>
  );
}

/** Saisie rapide d'une note de frais (peu de champs, gros boutons). */
function FraisTab() {
  const utils = trpc.useUtils();
  const can = useCan();
  const editable = can('create', 'Accounting');
  const list = trpc.expenses.list.useQuery();
  const create = trpc.expenses.create.useMutation({ onSuccess: () => { utils.expenses.list.invalidate(); setAmount(''); setDesc(''); setOk(true); setTimeout(() => setOk(false), 1800); } });
  const [category, setCategory] = useState('deplacement');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [ok, setOk] = useState(false);
  const rows = list.data ?? [];

  if (!editable) return <div className="text-secondary text-center py-5">Vous n'avez pas le droit de saisir des notes de frais.</div>;

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (desc.trim() && num(amount) >= 0) create.mutate({ date: new Date().toISOString().slice(0, 10), category, description: desc.trim(), amountHt: num(amount), taxRatePct: 20 }); }}
        className="d-grid gap-3 mb-4"
      >
        <div>
          <label htmlFor="m-cat" className="form-label small text-secondary mb-1">Catégorie</label>
          <select id="m-cat" className="form-select form-select-lg" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="m-amt" className="form-label small text-secondary mb-1">Montant HT (€)</label>
          <input id="m-amt" className="form-control form-control-lg" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="m-desc" className="form-label small text-secondary mb-1">Description</label>
          <input id="m-desc" className="form-control form-control-lg" placeholder="Ex. Péage A6" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={create.isPending || !desc.trim()}>
          {create.isPending ? 'Enregistrement…' : <><i className="bi bi-plus-lg me-1" aria-hidden="true" />Ajouter le frais</>}
        </button>
        {ok && <div className="alert alert-success py-2 mb-0" role="status"><i className="bi bi-check-circle me-2" aria-hidden="true" />Frais enregistré.</div>}
      </form>

      <div className="text-secondary small text-uppercase mb-2">Derniers frais</div>
      <div className="d-grid gap-2">
        {rows.slice(0, 8).map((e) => (
          <div key={e.id} className="d-flex justify-content-between align-items-center border rounded-3 p-2">
            <div className="me-2 text-truncate">
              <div className="fw-medium text-truncate">{e.description}</div>
              <div className="small text-secondary">{e.categoryLabel} · {dfmt(e.date)}</div>
            </div>
            <div className="text-end fw-semibold text-nowrap">{euro.format(e.ttc)}</div>
          </div>
        ))}
        {list.isSuccess && rows.length === 0 && <div className="text-secondary text-center py-3">Aucun frais</div>}
      </div>
    </div>
  );
}

/** Mes tâches en cours — action minime : « fait ». */
function TachesTab() {
  const utils = trpc.useUtils();
  const can = useCan();
  const tasks = trpc.crm.activities.tasks.useQuery();
  const complete = trpc.crm.activities.complete.useMutation({ onSuccess: () => utils.crm.activities.tasks.invalidate() });
  const rows = tasks.data ?? [];
  const editable = can('update', 'Opportunity');

  return (
    <div className="d-grid gap-2">
      {rows.map((a) => (
        <div key={a.id} className="d-flex justify-content-between align-items-center border rounded-3 p-2">
          <div className="me-2 text-truncate">
            <div className="fw-medium text-truncate">{a.content}</div>
            <div className="small text-secondary">{a.company?.name ?? '—'} · {dfmt(a.dueAt)}</div>
          </div>
          {editable && (
            <button className="btn btn-outline-success" onClick={() => complete.mutate({ id: a.id })} disabled={complete.isPending} aria-label="Marquer la tâche comme faite">
              <i className="bi bi-check-lg" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {tasks.isSuccess && rows.length === 0 && <div className="text-secondary text-center py-5">Aucune tâche en attente 🎉</div>}
    </div>
  );
}

/** Application mobile minimaliste (déplacements) : saisie de frais + tâches. Installable (PWA). */
export default function MobileApp() {
  const [tab, setTab] = useState<'frais' | 'taches'>('frais');
  return (
    <div className="d-flex flex-column" style={{ minHeight: '100dvh', background: 'var(--bs-body-bg)' }}>
      <header className="d-flex align-items-center justify-content-between px-3 py-2 text-white" style={{ background: '#3E3A52', position: 'sticky', top: 0, zIndex: 10 }}>
        <span className="fw-bold" style={{ letterSpacing: '.04em' }}>JAMPACK</span>
        {authEnabled && <LogoutButton />}
      </header>

      <main className="flex-grow-1 p-3" style={{ paddingBottom: 80, maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <h1 className="h5 fw-semibold mb-3">{tab === 'frais' ? 'Note de frais' : 'Mes tâches'}</h1>
        {tab === 'frais' ? <FraisTab /> : <TachesTab />}
      </main>

      <nav className="d-flex border-top text-center" style={{ position: 'sticky', bottom: 0, background: 'var(--bs-body-bg)', paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Navigation principale">
        <button className={`btn flex-fill rounded-0 py-2 ${tab === 'frais' ? 'text-primary fw-semibold' : 'text-secondary'}`} onClick={() => setTab('frais')} aria-current={tab === 'frais'}>
          <i className="bi bi-receipt d-block fs-5" aria-hidden="true" />Frais
        </button>
        <button className={`btn flex-fill rounded-0 py-2 ${tab === 'taches' ? 'text-primary fw-semibold' : 'text-secondary'}`} onClick={() => setTab('taches')} aria-current={tab === 'taches'}>
          <i className="bi bi-check2-square d-block fs-5" aria-hidden="true" />Tâches
        </button>
      </nav>
    </div>
  );
}
