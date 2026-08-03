import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Dropdown } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { trpc } from '../trpc';
import { activeSociete, ALL } from '../activeSociete';
import { defineAbilityFor } from '@jampack/domain';
import { applyTheme } from '../theme/applyTheme';
import { DOMAINS, DASHBOARD_VIEW, type View } from '../nav';

function SocieteSwitcher() {
  const utils = trpc.useUtils();
  const societes = trpc.societes.list.useQuery();
  const [sel, setSel] = useState<string>(''); // '' => 1re société (défaut serveur)

  const list = societes.data ?? [];
  const currentLabel =
    sel === ALL ? 'Toutes les sociétés' : list.find((s) => s.id === sel)?.name ?? list[0]?.name ?? 'Société';

  const choose = (v: string) => {
    setSel(v);
    activeSociete.set(v);
    utils.invalidate(); // toutes les listes se rechargent avec la nouvelle société
  };

  return (
    <Dropdown>
      <Dropdown.Toggle variant="light" size="sm" className="border d-flex align-items-center gap-2">
        <i className="bi bi-buildings text-primary" />
        <span className="fw-medium text-truncate" style={{ maxWidth: 180 }}>{currentLabel}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Header>Société active</Dropdown.Header>
        {list.map((s) => (
          <Dropdown.Item key={s.id} active={sel === s.id || (sel === '' && s.id === list[0]?.id)} onClick={() => choose(s.id)}>
            <i className="bi bi-building me-2 text-secondary" />
            {s.name}
            {s.city && <span className="text-secondary small ms-1">· {s.city}</span>}
          </Dropdown.Item>
        ))}
        <Dropdown.Divider />
        <Dropdown.Item active={sel === ALL} onClick={() => choose(ALL)}>
          <i className="bi bi-collection me-2 text-secondary" />
          Toutes les sociétés <span className="text-secondary small">(consolidé)</span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default function AppShell() {
  const auth = useAuth(); // undefined si OIDC désactivé (mode dev)
  const me = trpc.iam.me.useQuery();
  const ability = useMemo(() => defineAbilityFor(me.data?.permissions ?? []), [me.data]);

  // Look & feel du compte : applique la charte (couleurs de marque) au chargement.
  const theme = trpc.settings.getTheme.useQuery();
  useEffect(() => { if (theme.data) applyTheme(theme.data); }, [theme.data]);

  // Grands domaines filtrés par les droits (une vue s'affiche si son droit est accordé).
  // On n'applique le filtre qu'une fois les droits chargés, sinon le domaine actif par
  // défaut serait instable (un domaine sans droit requis « gagnerait » au 1er rendu).
  const domains = useMemo(() => {
    if (!me.isSuccess) return DOMAINS;
    return DOMAINS.map((d) => ({ ...d, views: d.views.filter((v) => !v.can || ability.can(v.can[0], v.can[1])) })).filter(
      (d) => d.views.length > 0
    );
  }, [me.isSuccess, ability]);

  // Table de toutes les vues (dashboard + toutes vues) pour retrouver un onglet par id.
  const viewsById = useMemo(() => {
    const m = new Map<string, View>();
    m.set(DASHBOARD_VIEW.id, DASHBOARD_VIEW);
    DOMAINS.forEach((d) => d.views.forEach((v) => m.set(v.id, v)));
    return m;
  }, []);

  const [activeDomainId, setActiveDomainId] = useState(DOMAINS[0].id);
  const [openIds, setOpenIds] = useState<string[]>([DASHBOARD_VIEW.id]); // dashboard épinglé en tête
  const [activeId, setActiveId] = useState(DASHBOARD_VIEW.id);
  const [subnavOpen, setSubnavOpen] = useState(true);
  // Mode d'affichage du panneau secondaire : « pinned » (statique, réserve sa place)
  // ou « overlay » (à la volée : flotte au-dessus du contenu et se referme après sélection).
  const [subnavMode, setSubnavMode] = useState<'pinned' | 'overlay'>(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem('jampack.subnavMode') === 'overlay' ? 'overlay' : 'pinned')
  );
  useEffect(() => { try { localStorage.setItem('jampack.subnavMode', subnavMode); } catch { /* stockage indisponible */ } }, [subnavMode]);
  const [dark, setDark] = useState(false);

  // Sélectionne un domaine valide dès que les droits sont chargés.
  useEffect(() => {
    if (!domains.find((d) => d.id === activeDomainId) && domains[0]) setActiveDomainId(domains[0].id);
  }, [domains, activeDomainId]);

  const activeDomain = domains.find((d) => d.id === activeDomainId) ?? domains[0];

  const openView = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveId(id);
    if (subnavMode === 'overlay') setSubnavOpen(false); // « à la volée » : referme après sélection
  };

  const closeTab = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (id === DASHBOARD_VIEW.id) return; // onglet épinglé, non fermable
    setOpenIds((prev) => {
      const idx = prev.indexOf(id);
      const next = prev.filter((x) => x !== id);
      if (activeId === id) setActiveId(next[idx - 1] ?? next[idx] ?? DASHBOARD_VIEW.id);
      return next;
    });
  };

  // ── Gestion des onglets (menu contextuel type navigateur) ──
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // Ferme selon un prédicat « garder » — l'onglet épinglé est toujours conservé.
  const applyClose = (keep: (id: string, idx: number, target: number) => boolean) => {
    setOpenIds((prev) => {
      const target = menu ? prev.indexOf(menu.id) : -1;
      const next = prev.filter((id, idx) => id === DASHBOARD_VIEW.id || keep(id, idx, target));
      if (!next.includes(activeId)) setActiveId(next[next.length - 1] ?? DASHBOARD_VIEW.id);
      return next;
    });
    setMenu(null);
  };
  const closeThis = () => applyClose((id) => id !== menu?.id);
  const closeOthers = () => applyClose((id) => id === menu?.id);
  const closeLeft = () => applyClose((_id, idx, target) => idx >= target);
  const closeRight = () => applyClose((_id, idx, target) => idx <= target);
  const closeAll = () => applyClose(() => false);

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    setDark(!dark);
  };

  const displayName = auth?.user?.profile?.name || auth?.user?.profile?.email || 'Admin Démo';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className={`hk-wrapper${subnavOpen ? '' : ' subnav-collapsed'}${subnavMode === 'overlay' ? ' subnav-overlay' : ''}`}>
      {/* Barre du haut */}
      <nav className="hk-navbar">
        <button className="btn btn-icon btn-sm btn-light border-0" onClick={() => setSubnavOpen((c) => !c)} aria-label="Basculer le panneau">
          <i className="bi bi-layout-sidebar fs-5" />
        </button>
        <span className="brand ms-1 me-3">JAMPACK</span>
        <SocieteSwitcher />

        <div className="ms-auto d-flex align-items-center gap-2">
          <button className="btn btn-icon btn-sm btn-light border-0" title="Aide / how-to" aria-label="Aide">
            <i className="bi bi-question-circle fs-6" />
          </button>
          <button className="btn btn-icon btn-sm btn-light border-0" onClick={toggleTheme} aria-label="Thème">
            <i className={`bi ${dark ? 'bi-sun' : 'bi-moon-stars'} fs-6`} />
          </button>
          <Dropdown align="end">
            <Dropdown.Toggle variant="light" size="sm" className="border-0 d-flex align-items-center gap-2">
              <span className="rounded-circle bg-primary text-white d-inline-grid" style={{ width: 30, height: 30, placeItems: 'center', fontSize: 13 }}>
                {initials}
              </span>
              <span className="d-none d-sm-inline">{displayName}</span>
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Header>{auth?.user?.profile?.email ?? 'mode dev'}</Dropdown.Header>
              <Dropdown.Item><i className="bi bi-person me-2" />Profil</Dropdown.Item>
              <Dropdown.Item><i className="bi bi-building me-2" />Sociétés du compte</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item className="text-danger" disabled={!auth} onClick={() => auth?.signoutRedirect()}>
                <i className="bi bi-box-arrow-right me-2" />Déconnexion
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </nav>

      {/* Barre d'activité : grands domaines */}
      <div className="hk-activity">
        <button
          className={`act${activeId === DASHBOARD_VIEW.id ? ' active' : ''}`}
          title="Accueil — tableau de bord"
          onClick={() => setActiveId(DASHBOARD_VIEW.id)}
        >
          <i className="bi bi-house-door-fill" />
        </button>
        <hr className="w-50 my-1 opacity-25" />
        {domains.map((d) => (
          <button
            key={d.id}
            className={`act${d.id === activeDomainId ? ' active' : ''}`}
            title={d.label}
            onClick={() => {
              // Comme VS Code : re-cliquer le domaine actif bascule son panneau ;
              // cliquer un autre domaine le sélectionne et ouvre le panneau.
              if (d.id === activeDomainId) setSubnavOpen((o) => !o);
              else { setActiveDomainId(d.id); setSubnavOpen(true); }
            }}
          >
            <i className={`bi ${d.icon}`} />
          </button>
        ))}
      </div>

      {/* Fond cliquable (mode à la volée) : referme le panneau au clic à côté */}
      {subnavMode === 'overlay' && subnavOpen && <div className="hk-subnav-backdrop" onClick={() => setSubnavOpen(false)} />}

      {/* Panneau secondaire : sous-domaines du domaine actif */}
      <aside className="hk-subnav">
        <div className="subnav-head">
          <span className="subnav-title">{activeDomain?.label ?? '—'}</span>
          <div className="subnav-actions">
            <button
              className={`subnav-act${subnavMode === 'pinned' ? ' on' : ''}`}
              title={subnavMode === 'overlay' ? 'Affichage à la volée — cliquer pour épingler' : 'Panneau épinglé — cliquer pour affichage à la volée'}
              onClick={() => setSubnavMode((m) => (m === 'overlay' ? 'pinned' : 'overlay'))}
            >
              <i className={`bi ${subnavMode === 'pinned' ? 'bi-pin-angle-fill' : 'bi-pin-angle'}`} />
            </button>
            <button className="subnav-act" title="Fermer le panneau" onClick={() => setSubnavOpen(false)}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
        {activeDomain?.views.map((v) => (
          <a key={v.id} className={`nav-link${activeId === v.id ? ' active' : ''}`} onClick={() => openView(v.id)}>
            <i className={`bi ${v.icon}`} />
            <span>{v.label}</span>
          </a>
        ))}
      </aside>

      {/* Espace de travail : barre d'onglets */}
      <div className="hk-tabbar">
        {openIds.map((id) => {
          const v = viewsById.get(id);
          if (!v) return null;
          const pinned = id === DASHBOARD_VIEW.id;
          return (
            <div
              key={id}
              className={`hk-tab${activeId === id ? ' active' : ''}`}
              onClick={() => setActiveId(id)}
              onContextMenu={(e) => { e.preventDefault(); setActiveId(id); setMenu({ id, x: e.clientX, y: e.clientY }); }}
              title={v.label}
            >
              <i className={`bi ${v.icon}`} />
              <span>{v.label}</span>
              {pinned ? (
                <i className="bi bi-pin-angle-fill ms-1 small opacity-50" />
              ) : (
                <button className="tab-close" onClick={(e) => closeTab(id, e)} aria-label="Fermer l'onglet">
                  <i className="bi bi-x" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Espace de travail : contenu (onglets ouverts conservés, seul l'actif est visible) */}
      <main className="hk-content">
        {openIds.map((id) => {
          const v = viewsById.get(id);
          if (!v) return null;
          return (
            <div key={id} className={activeId === id ? '' : 'd-none'}>
              {v.element}
            </div>
          );
        })}
      </main>

      {/* Menu contextuel des onglets (type navigateur), relatif à l'onglet ciblé */}
      {menu && (
        <>
          <div className="hk-ctx-backdrop" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="hk-ctx" style={{ top: menu.y, left: menu.x }}>
            {menu.id !== DASHBOARD_VIEW.id && (
              <button className="hk-ctx-item" onClick={closeThis}><i className="bi bi-x-lg" />Fermer</button>
            )}
            <button className="hk-ctx-item" onClick={closeOthers}><i className="bi bi-x-circle" />Fermer les autres</button>
            <button className="hk-ctx-item" onClick={closeLeft}><i className="bi bi-arrow-bar-left" />Fermer à gauche</button>
            <button className="hk-ctx-item" onClick={closeRight}><i className="bi bi-arrow-bar-right" />Fermer à droite</button>
            <div className="hk-ctx-sep" />
            <button className="hk-ctx-item" onClick={closeAll}><i className="bi bi-x-octagon" />Tout fermer</button>
          </div>
        </>
      )}
    </div>
  );
}
