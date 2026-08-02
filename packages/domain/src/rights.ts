// ──────────────────────────────────────────────────────────────
// Modèle de droits JAMPACK
// Arbre : Module ▸ Domaine ▸ Action (voir / créer / modifier + actions spécifiques).
// Un droit s'écrit `module.domaine.action`. Droits GÉNÉRIQUES via wildcards :
//   `*` (tout), `module.*` (tout le module), `module.domaine.*` (toutes les actions du domaine).
// Un droit peut porter PLUSIEURS actions (une entrée = un périmètre + une action ; un rôle = liste).
// ──────────────────────────────────────────────────────────────

export type Action = 'voir' | 'creer' | 'modifier' | (string & {});

export interface DomaineDef { key: string; label: string; actions: Action[] }
export interface ModuleDef { key: string; label: string; domaines: DomaineDef[] }

const CRUD: Action[] = ['voir', 'creer', 'modifier'];

/** Catalogue de référence des droits — source unique pour l'éditeur de rôle et le contrôle serveur. */
export const RIGHTS_TREE: ModuleDef[] = [
  { key: 'admin', label: 'Administration', domaines: [
    { key: 'utilisateurs', label: 'Utilisateurs', actions: CRUD },
    { key: 'roles', label: 'Rôles', actions: CRUD },
    { key: 'societes', label: 'Sociétés', actions: CRUD },
    { key: 'compte', label: 'Compte', actions: ['voir', 'modifier'] },
  ] },
  { key: 'parametres', label: 'Paramètres', domaines: [
    { key: 'tva', label: 'TVA', actions: CRUD },
    { key: 'numerotation', label: 'Numérotation', actions: ['voir', 'modifier'] },
    { key: 'modeles', label: 'Modèles de documents', actions: CRUD },
  ] },
  { key: 'crm', label: 'CRM', domaines: [
    { key: 'clients', label: 'Clients', actions: CRUD },
    { key: 'contacts', label: 'Contacts', actions: CRUD },
    { key: 'etablissements', label: 'Établissements', actions: CRUD },
    { key: 'opportunites', label: 'Opportunités', actions: CRUD },
    { key: 'activites', label: 'Activités', actions: CRUD },
  ] },
  { key: 'catalogue', label: 'Catalogue', domaines: [
    { key: 'articles', label: 'Articles & services', actions: CRUD },
  ] },
  { key: 'ventes', label: 'Ventes', domaines: [
    { key: 'devis', label: 'Devis', actions: CRUD },
    { key: 'factures', label: 'Factures', actions: [...CRUD, 'valider'] },
    { key: 'avoirs', label: 'Avoirs', actions: CRUD },
    { key: 'reglements', label: 'Règlements', actions: CRUD },
  ] },
  { key: 'achats', label: 'Achats', domaines: [
    { key: 'fournisseurs', label: 'Fournisseurs', actions: CRUD },
    { key: 'commandes', label: 'Commandes fournisseurs', actions: CRUD },
    { key: 'receptions', label: 'Réceptions', actions: CRUD },
    { key: 'factures', label: 'Factures fournisseurs', actions: CRUD },
  ] },
  { key: 'stock', label: 'Stock', domaines: [
    { key: 'entrepots', label: 'Entrepôts', actions: CRUD },
    { key: 'mouvements', label: 'Mouvements', actions: CRUD },
    { key: 'inventaires', label: 'Inventaires', actions: CRUD },
  ] },
  { key: 'compta', label: 'Comptabilité', domaines: [
    { key: 'journaux', label: 'Journaux', actions: CRUD },
    { key: 'ecritures', label: 'Écritures', actions: CRUD },
    { key: 'tva', label: 'TVA', actions: ['voir', 'declarer'] },
    { key: 'fec', label: 'FEC', actions: ['voir', 'exporter'] },
  ] },
];

/** Toutes les feuilles concrètes `module.domaine.action` du catalogue. */
export function allLeafCodes(tree: ModuleDef[] = RIGHTS_TREE): string[] {
  const out: string[] = [];
  for (const m of tree) for (const d of m.domaines) for (const a of d.actions) out.push(`${m.key}.${d.key}.${a}`);
  return out;
}

/** Un grant (éventuellement générique) couvre-t-il un code concret `module.domaine.action` ? */
export function grantCovers(grant: string, required: string): boolean {
  if (grant === '*' || grant === required) return true;
  if (grant.endsWith('.*')) return required.startsWith(grant.slice(0, -1)); // "ventes." couvre "ventes.factures.creer"
  return false;
}

/** L'ensemble des grants accorde-t-il le droit requis ? */
export function hasRight(grants: string[], required: string): boolean {
  return grants.some((g) => grantCovers(g, required));
}

/** Développe des grants (avec génériques) en l'ensemble des feuilles concrètes couvertes. */
export function expandGrants(grants: string[], tree: ModuleDef[] = RIGHTS_TREE): Set<string> {
  return new Set(allLeafCodes(tree).filter((leaf) => hasRight(grants, leaf)));
}

export type NodeState = 'checked' | 'partial' | 'unchecked';

/** État tri-état d'un nœud (`module` ou `module.domaine`) au regard des feuilles sélectionnées. */
export function nodeState(prefix: string, selected: Set<string>, tree: ModuleDef[] = RIGHTS_TREE): NodeState {
  const leaves = allLeafCodes(tree).filter((l) => l === prefix || l.startsWith(prefix + '.'));
  if (leaves.length === 0) return 'unchecked';
  const n = leaves.filter((l) => selected.has(l)).length;
  return n === 0 ? 'unchecked' : n === leaves.length ? 'checked' : 'partial';
}

/** Feuilles cochées → grants compactés : remonte au générique quand un sous-arbre est entièrement coché. */
export function compactGrants(selected: Set<string>, tree: ModuleDef[] = RIGHTS_TREE): string[] {
  if (allLeafCodes(tree).every((l) => selected.has(l))) return ['*'];
  const grants: string[] = [];
  for (const m of tree) {
    if (nodeState(m.key, selected, tree) === 'checked') { grants.push(`${m.key}.*`); continue; }
    for (const d of m.domaines) {
      const dp = `${m.key}.${d.key}`;
      if (nodeState(dp, selected, tree) === 'checked') { grants.push(`${dp}.*`); continue; }
      for (const a of d.actions) if (selected.has(`${dp}.${a}`)) grants.push(`${dp}.${a}`);
    }
  }
  return grants;
}

/** Feuilles portant une action donnée (utile pour construire des rôles « toutes actions X »). */
export function leavesByAction(action: Action, tree: ModuleDef[] = RIGHTS_TREE): string[] {
  return allLeafCodes(tree).filter((l) => l.endsWith(`.${action}`));
}

/** Rôles prédéfinis (grants). Duplicables/personnalisables par compte. */
export const PREDEFINED_ROLES: Record<string, string[]> = {
  Administrateur: ['*'],
  Commercial: ['crm.*', 'catalogue.articles.voir', 'ventes.devis.*', 'ventes.factures.voir'],
  Facturation: ['crm.clients.voir', 'catalogue.articles.voir', 'ventes.*'],
  Stock: ['catalogue.articles.*', 'stock.*', 'achats.receptions.*'],
  Comptable: ['compta.*', 'parametres.tva.voir',
    ...leavesByAction('voir').filter((l) => l.startsWith('ventes.') || l.startsWith('achats.'))],
  'Lecture seule': leavesByAction('voir'),
};
