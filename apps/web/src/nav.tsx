import type { ReactNode } from 'react';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Clients from './pages/Clients';
import Contacts from './pages/Contacts';
import Catalogue from './pages/Catalogue';
import Factures from './pages/Factures';
import Settings from './pages/Settings';
import Appearance from './pages/Appearance';
import Placeholder from './pages/Placeholder';

/**
 * Modèle de navigation type VS Code :
 *  - grands domaines  = barre d'activité (gauche)
 *  - sous-domaines    = panneau secondaire (vues ouvrables en onglets)
 *  - `can` (optionnel) = droit requis pour afficher la vue [action, subject]
 */
export type View = { id: string; label: string; icon: string; element: ReactNode; can?: [string, string] };
export type Domain = { id: string; label: string; icon: string; views: View[] };

/** Onglet fixe, toujours présent et non fermable : le tableau de bord personnel. */
export const DASHBOARD_VIEW: View = {
  id: 'dashboard',
  label: 'Tableau de bord',
  icon: 'bi-grid-1x2-fill',
  element: <Dashboard />,
};

export const DOMAINS: Domain[] = [
  {
    id: 'crm',
    label: 'CRM',
    icon: 'bi-people-fill',
    views: [
      { id: 'companies', label: 'Clients', icon: 'bi-briefcase', element: <Clients />, can: ['read', 'Company'] },
      { id: 'contacts', label: 'Contacts', icon: 'bi-person-lines-fill', element: <Contacts />, can: ['read', 'Contact'] },
      { id: 'pipeline', label: 'Pipeline', icon: 'bi-kanban', element: <Pipeline />, can: ['read', 'Opportunity'] },
    ],
  },
  {
    id: 'ventes',
    label: 'Ventes',
    icon: 'bi-receipt',
    views: [
      { id: 'catalog', label: 'Catalogue', icon: 'bi-box-seam', element: <Catalogue />, can: ['read', 'Product'] },
      { id: 'invoices', label: 'Factures', icon: 'bi-file-earmark-text', element: <Factures />, can: ['read', 'Invoice'] },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestion',
    icon: 'bi-calendar3',
    views: [
      { id: 'calendar', label: 'Agenda', icon: 'bi-calendar3', element: <Placeholder title="Agenda" /> },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: 'bi-gear-fill',
    views: [
      { id: 'settings', label: 'Paramètres', icon: 'bi-sliders', element: <Settings /> },
      { id: 'appearance', label: 'Apparence', icon: 'bi-palette', element: <Appearance />, can: ['manage', 'all'] },
    ],
  },
];
