import type { ReactNode } from 'react';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Activities from './pages/Activities';
import Clients from './pages/Clients';
import Contacts from './pages/Contacts';
import Catalogue from './pages/Catalogue';
import Devis from './pages/Devis';
import QuotesExpiring from './pages/QuotesExpiring';
import Factures from './pages/Factures';
import Avoirs from './pages/Avoirs';
import Echeancier from './pages/Echeancier';
import Reminders from './pages/Reminders';
import RecurringInvoices from './pages/RecurringInvoices';
import TimeTracking from './pages/TimeTracking';
import PurchaseOrders from './pages/PurchaseOrders';
import OverduePurchaseOrders from './pages/OverduePurchaseOrders';
import SupplierInvoices from './pages/SupplierInvoices';
import SupplierEcheancier from './pages/SupplierEcheancier';
import Expenses from './pages/Expenses';
import StockLevels from './pages/StockLevels';
import StockValuation from './pages/StockValuation';
import StockMovements from './pages/StockMovements';
import StockLots from './pages/StockLots';
import Warehouses from './pages/Warehouses';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalEntries from './pages/JournalEntries';
import TrialBalance from './pages/TrialBalance';
import Ledger from './pages/Ledger';
import VatReturn from './pages/VatReturn';
import LiasseFiscale from './pages/LiasseFiscale';
import FinancialStatements from './pages/FinancialStatements';
import Lettrage from './pages/Lettrage';
import BankReconciliation from './pages/BankReconciliation';
import FixedAssets from './pages/FixedAssets';
import Tresorerie from './pages/Tresorerie';
import AgedReceivables from './pages/AgedReceivables';
import Settings from './pages/Settings';
import Appearance from './pages/Appearance';
import SocieteSettings from './pages/SocieteSettings';
import BillingSettings from './pages/BillingSettings';
import AiCredits from './pages/AiCredits';
import OpsConsole from './pages/OpsConsole';
import Members from './pages/Members';
import Societes from './pages/Societes';
import AuditLog from './pages/AuditLog';
import RgpdPurge from './pages/RgpdPurge';
import Agenda from './pages/Agenda';

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
      { id: 'activities', label: 'Activités & tâches', icon: 'bi-check2-square', element: <Activities />, can: ['read', 'Opportunity'] },
    ],
  },
  {
    id: 'ventes',
    label: 'Ventes',
    icon: 'bi-receipt',
    views: [
      { id: 'catalog', label: 'Catalogue', icon: 'bi-box-seam', element: <Catalogue />, can: ['read', 'Product'] },
      { id: 'quotes', label: 'Devis', icon: 'bi-file-earmark-ruled', element: <Devis />, can: ['read', 'Quote'] },
      { id: 'quotes-expiring', label: 'Devis à échéance', icon: 'bi-hourglass-bottom', element: <QuotesExpiring />, can: ['read', 'Quote'] },
      { id: 'invoices', label: 'Factures', icon: 'bi-file-earmark-text', element: <Factures />, can: ['read', 'Invoice'] },
      { id: 'credit-notes', label: 'Avoirs', icon: 'bi-file-earmark-minus', element: <Avoirs />, can: ['read', 'CreditNote'] },
      { id: 'echeancier', label: 'Échéancier', icon: 'bi-calendar-check', element: <Echeancier />, can: ['read', 'Payment'] },
      { id: 'reminders', label: 'Relances', icon: 'bi-envelope-exclamation', element: <Reminders />, can: ['read', 'Payment'] },
      { id: 'recurring', label: 'Abonnements', icon: 'bi-arrow-repeat', element: <RecurringInvoices />, can: ['read', 'Invoice'] },
      { id: 'time', label: 'Suivi du temps', icon: 'bi-stopwatch', element: <TimeTracking />, can: ['read', 'Invoice'] },
    ],
  },
  {
    id: 'achats',
    label: 'Achats',
    icon: 'bi-cart',
    views: [
      { id: 'purchase-orders', label: 'Commandes', icon: 'bi-cart-check', element: <PurchaseOrders />, can: ['read', 'PurchaseOrder'] },
      { id: 'purchase-overdue', label: 'Commandes en retard', icon: 'bi-clock-history', element: <OverduePurchaseOrders />, can: ['read', 'PurchaseOrder'] },
      { id: 'supplier-invoices', label: 'Factures fournisseurs', icon: 'bi-receipt-cutoff', element: <SupplierInvoices />, can: ['read', 'SupplierInvoice'] },
      { id: 'supplier-echeancier', label: 'Échéancier fournisseur', icon: 'bi-calendar-minus', element: <SupplierEcheancier />, can: ['read', 'SupplierInvoice'] },
      { id: 'expenses', label: 'Notes de frais', icon: 'bi-receipt', element: <Expenses />, can: ['read', 'Accounting'] },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: 'bi-boxes',
    views: [
      { id: 'stock-levels', label: 'Niveaux', icon: 'bi-clipboard-data', element: <StockLevels />, can: ['read', 'StockMovement'] },
      { id: 'stock-valuation', label: 'Valorisation', icon: 'bi-cash-stack', element: <StockValuation />, can: ['read', 'StockMovement'] },
      { id: 'stock-movements', label: 'Mouvements', icon: 'bi-arrow-left-right', element: <StockMovements />, can: ['read', 'StockMovement'] },
      { id: 'stock-lots', label: 'Lots & péremption', icon: 'bi-upc-scan', element: <StockLots />, can: ['read', 'StockMovement'] },
      { id: 'warehouses', label: 'Entrepôts', icon: 'bi-building', element: <Warehouses />, can: ['read', 'Warehouse'] },
    ],
  },
  {
    id: 'compta',
    label: 'Comptabilité',
    icon: 'bi-journal-bookmark-fill',
    views: [
      { id: 'chart-of-accounts', label: 'Plan comptable', icon: 'bi-list-ol', element: <ChartOfAccounts />, can: ['read', 'Accounting'] },
      { id: 'journal-entries', label: 'Écritures', icon: 'bi-pencil-square', element: <JournalEntries />, can: ['read', 'Accounting'] },
      { id: 'trial-balance', label: 'Balance', icon: 'bi-bar-chart-steps', element: <TrialBalance />, can: ['read', 'Accounting'] },
      { id: 'ledger', label: 'Grand livre', icon: 'bi-journal-text', element: <Ledger />, can: ['read', 'Accounting'] },
      { id: 'lettrage', label: 'Lettrage', icon: 'bi-link-45deg', element: <Lettrage />, can: ['read', 'Accounting'] },
      { id: 'bank-rec', label: 'Rapprochement bancaire', icon: 'bi-bank', element: <BankReconciliation />, can: ['read', 'Accounting'] },
      { id: 'fixed-assets', label: 'Immobilisations', icon: 'bi-buildings-fill', element: <FixedAssets />, can: ['read', 'Accounting'] },
      { id: 'financial-statements', label: 'États financiers', icon: 'bi-clipboard2-data', element: <FinancialStatements />, can: ['read', 'Accounting'] },
      { id: 'vat-return', label: 'Déclaration TVA', icon: 'bi-percent', element: <VatReturn />, can: ['read', 'Accounting'] },
      { id: 'liasse', label: 'Liasse fiscale', icon: 'bi-file-earmark-medical', element: <LiasseFiscale />, can: ['read', 'Accounting'] },
    ],
  },
  {
    id: 'tresorerie',
    label: 'Trésorerie',
    icon: 'bi-graph-up-arrow',
    views: [
      { id: 'cashflow', label: 'Prévisionnel', icon: 'bi-wallet2', element: <Tresorerie />, can: ['read', 'Invoice'] },
      { id: 'aged-receivables', label: 'Balance âgée', icon: 'bi-hourglass-split', element: <AgedReceivables />, can: ['read', 'Invoice'] },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestion',
    icon: 'bi-calendar3',
    views: [
      { id: 'calendar', label: 'Agenda', icon: 'bi-calendar3', element: <Agenda /> },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: 'bi-gear-fill',
    views: [
      { id: 'settings', label: 'Paramètres', icon: 'bi-sliders', element: <Settings /> },
      { id: 'societes', label: 'Sociétés', icon: 'bi-buildings', element: <Societes />, can: ['manage', 'all'] },
      { id: 'members', label: 'Utilisateurs & rôles', icon: 'bi-people-fill', element: <Members />, can: ['manage', 'all'] },
      { id: 'audit', label: 'Journal d\'audit', icon: 'bi-shield-check', element: <AuditLog />, can: ['manage', 'all'] },
      { id: 'rgpd-purge', label: 'Purge RGPD', icon: 'bi-person-x', element: <RgpdPurge />, can: ['manage', 'all'] },
      { id: 'company', label: 'Société (facturation)', icon: 'bi-building-gear', element: <SocieteSettings />, can: ['manage', 'all'] },
      { id: 'billing', label: 'Facturation (banques, affacturage…)', icon: 'bi-bank', element: <BillingSettings />, can: ['manage', 'all'] },
      { id: 'ai-credits', label: 'Crédits IA', icon: 'bi-magic', element: <AiCredits />, can: ['manage', 'all'] },
      { id: 'ops', label: 'Pilotage technique', icon: 'bi-terminal', element: <OpsConsole />, can: ['manage', 'Ops'] },
      { id: 'appearance', label: 'Apparence', icon: 'bi-palette', element: <Appearance />, can: ['manage', 'all'] },
    ],
  },
];
