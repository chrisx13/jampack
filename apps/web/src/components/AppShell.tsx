import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { trpc } from '../trpc';
import { activeSociete, ALL } from '../activeSociete';

const NAV: { header: string; items: { to: string; icon: string; label: string }[] }[] = [
  {
    header: 'Pilotage',
    items: [
      { to: '/', icon: 'bi-grid-1x2', label: 'Tableau de bord' },
      { to: '/pipeline', icon: 'bi-kanban', label: 'Pipeline' },
    ],
  },
  {
    header: 'CRM',
    items: [
      { to: '/companies', icon: 'bi-briefcase', label: 'Clients' },
      { to: '/contacts', icon: 'bi-people', label: 'Contacts' },
    ],
  },
  {
    header: 'Ventes',
    items: [
      { to: '/catalog', icon: 'bi-box-seam', label: 'Catalogue' },
      { to: '/invoices', icon: 'bi-receipt', label: 'Factures' },
    ],
  },
  {
    header: 'Gestion',
    items: [
      { to: '/calendar', icon: 'bi-calendar3', label: 'Agenda' },
      { to: '/settings', icon: 'bi-gear', label: 'Paramètres' },
    ],
  },
];

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

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const auth = useAuth(); // undefined si OIDC désactivé (mode dev)
  const displayName = auth?.user?.profile?.name || auth?.user?.profile?.email || 'Admin Démo';
  const initials = displayName.slice(0, 2).toUpperCase();

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    setDark(!dark);
  };

  return (
    <div className={`hk-wrapper${collapsed ? ' is-collapsed' : ''}`}>
      <nav className="hk-navbar">
        <button className="btn btn-icon btn-sm btn-light border-0" onClick={() => setCollapsed((c) => !c)} aria-label="Menu">
          <i className="bi bi-list fs-5" />
        </button>
        <span className="brand ms-1 me-3">JAMPACK</span>
        <SocieteSwitcher />

        <div className="ms-auto d-flex align-items-center gap-2">
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
              <Dropdown.Item
                className="text-danger"
                disabled={!auth}
                onClick={() => auth?.signoutRedirect()}
              >
                <i className="bi bi-box-arrow-right me-2" />Déconnexion
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </nav>

      <aside className="hk-menu">
        {NAV.map((group) => (
          <div key={group.header}>
            <div className="nav-header">{group.header}</div>
            {group.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/'} className="nav-link">
                <i className={`bi ${it.icon}`} />
                <span>{it.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      <main className="hk-pg-wrapper">{children}</main>
    </div>
  );
}
