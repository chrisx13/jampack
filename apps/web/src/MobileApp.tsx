import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { trpc } from './trpc';
import { useCan } from './ability';
import { authEnabled } from './auth';
import { activeSociete } from './activeSociete';
import { EXPENSE_CATEGORIES } from '@jampack/domain';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dfmt = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '—');
const num = (v: unknown) => { const n = Number(v as never); return Number.isFinite(n) ? n : 0; };

/** Redimensionne et compresse une image (fichier) en data-URL JPEG (côté client, sans upload de fichier). */
function downscaleImage(file: File, maxSize = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('lecture'));
    reader.onload = () => { img.src = reader.result as string; };
    img.onerror = () => reject(new Error('image'));
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    reader.readAsDataURL(file);
  });
}

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
  const editable = can('create', 'Expense');
  const list = trpc.expenses.list.useQuery();
  const create = trpc.expenses.create.useMutation({ onSuccess: () => { utils.expenses.list.invalidate(); setAmount(''); setDesc(''); setReceipt(null); setOk(true); setTimeout(() => setOk(false), 1800); } });
  const [category, setCategory] = useState('deplacement');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState('');
  const [ok, setOk] = useState(false);
  const rows = list.data ?? [];

  const onPhoto = async (file?: File) => {
    setPhotoErr('');
    if (!file) return;
    try {
      const data = await downscaleImage(file);
      if (data.length > 2_700_000) { setPhotoErr('Photo trop lourde même après compression.'); return; }
      setReceipt(data);
    } catch { setPhotoErr('Impossible de traiter la photo.'); }
  };

  if (!editable) return <div className="text-secondary text-center py-5">Vous n'avez pas le droit de saisir des notes de frais.</div>;

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (desc.trim() && num(amount) >= 0) create.mutate({ date: new Date().toISOString().slice(0, 10), category, description: desc.trim(), amountHt: num(amount), taxRatePct: 20, receipt: receipt ?? undefined }); }}
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
        <div>
          <label className="form-label small text-secondary mb-1">Justificatif (photo, optionnel)</label>
          {receipt ? (
            <div className="d-flex align-items-center gap-2">
              <img src={receipt} alt="Aperçu du justificatif" style={{ height: 56, width: 56, objectFit: 'cover', borderRadius: 8 }} />
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setReceipt(null)}><i className="bi bi-x-lg me-1" aria-hidden="true" />Retirer</button>
            </div>
          ) : (
            <label className="btn btn-outline-secondary btn-lg w-100">
              <i className="bi bi-camera me-1" aria-hidden="true" />Prendre une photo
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          )}
          {photoErr && <div className="text-danger small mt-1">{photoErr}</div>}
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={create.isPending || !desc.trim()}>
          {create.isPending ? 'Enregistrement…' : <><i className="bi bi-plus-lg me-1" aria-hidden="true" />Ajouter le frais</>}
        </button>
        {create.isError && <div className="alert alert-danger py-2 mb-0" role="alert">{create.error.message}</div>}
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

/** Sélecteur de société (mobile) — visible seulement si l'utilisateur a accès à plusieurs sociétés. */
function SocietePicker() {
  const utils = trpc.useUtils();
  const societes = trpc.societes.list.useQuery();
  const [sel, setSel] = useState(activeSociete.get());
  const list = societes.data ?? [];
  if (list.length < 2) return null;
  return (
    <select
      aria-label="Société active"
      className="form-select form-select-sm border-0 text-white"
      style={{ background: 'rgba(255,255,255,.15)', maxWidth: 170 }}
      value={sel}
      onChange={(e) => { const v = e.target.value; setSel(v); activeSociete.set(v); utils.invalidate(); }}
    >
      {sel === '' && <option value="">{list[0]?.name}</option>}
      {list.map((s) => <option key={s.id} value={s.id} style={{ color: '#1f2937' }}>{s.name}</option>)}
    </select>
  );
}

/** Application mobile minimaliste (déplacements) : saisie de frais + tâches. Installable (PWA). */
export default function MobileApp() {
  const [tab, setTab] = useState<'frais' | 'taches'>('frais');
  return (
    <div className="d-flex flex-column" style={{ minHeight: '100dvh', background: 'var(--bs-body-bg)' }}>
      <header className="d-flex align-items-center justify-content-between gap-2 px-3 py-2 text-white" style={{ background: '#3E3A52', position: 'sticky', top: 0, zIndex: 10 }}>
        <span className="fw-bold" style={{ letterSpacing: '.04em' }}>JAMPACK</span>
        <div className="d-flex align-items-center gap-2">
          <SocietePicker />
          {authEnabled && <LogoutButton />}
        </div>
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
