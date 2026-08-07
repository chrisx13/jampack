// Catalogue d'opérations techniques — console super-admin de pilotage (« sans SSH »).
//
// PRINCIPE DE SÉCURITÉ : aucune exécution de shell arbitraire. Seules des opérations **prédéfinies**,
// paramétrées et validées sont exposées. Chaque opération porte : niveau de danger, avertissements,
// paramètres, support du dry-run, et — pour les actions sensibles — une **confirmation typée**.
// L'exécution réelle vit côté backend (exécuteur), gated par le rôle super-admin et journalisée.
//
// Ce module est PUR (métadonnées + validation) → testable et partagé web/api.

export type OpDanger = 'safe' | 'caution' | 'danger';
export type OpScope = 'instance' | 'fleet' | 'both';
export type OpCategory = 'base' | 'donnees' | 'maintenance' | 'observabilite' | 'securite';

export interface OpParam {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
}

export interface OpDef {
  id: string;
  label: string;
  description: string;
  category: OpCategory;
  danger: OpDanger;
  /** Portée : agit sur l'instance, la flotte, ou les deux (choix de cible côté UI). */
  scope: OpScope;
  /** Avertissements affichés AVANT exécution (impact, irréversibilité, prérequis…). */
  warnings: string[];
  params: OpParam[];
  supportsDryRun: boolean;
  /** Si vrai : l'utilisateur doit saisir exactement `confirmToken` pour exécuter (pas en dry-run). */
  requiresConfirmation: boolean;
  confirmToken?: string;
  /** Opération exécutée en-process/BDD (sûre) vs nécessitant un runner hôte (désactivé par défaut). */
  needsHostRunner: boolean;
}

export const OPS_CATEGORIES: { key: OpCategory; label: string }[] = [
  { key: 'base', label: 'Base' },
  { key: 'observabilite', label: 'Observabilité' },
  { key: 'securite', label: 'Sécurité' },
  { key: 'donnees', label: 'Données' },
  { key: 'maintenance', label: 'Maintenance' },
];

export const OPS_CATALOG: OpDef[] = [
  {
    id: 'app.info',
    label: 'Informations d’instance',
    description: 'Version applicative, environnement (non sensible), horodatage serveur, base connectée.',
    category: 'base', danger: 'safe', scope: 'both',
    warnings: [], params: [], supportsDryRun: false, requiresConfirmation: false, needsHostRunner: false,
  },
  {
    id: 'db.health',
    label: 'Santé de la base',
    description: 'Vérifie la connectivité PostgreSQL et compte les entités clés (organisations, sociétés, écritures).',
    category: 'observabilite', danger: 'safe', scope: 'both',
    warnings: [], params: [], supportsDryRun: false, requiresConfirmation: false, needsHostRunner: false,
  },
  {
    id: 'migrations.status',
    label: 'État des migrations',
    description: 'Liste les migrations Prisma appliquées et détecte d’éventuelles migrations en attente.',
    category: 'observabilite', danger: 'safe', scope: 'both',
    warnings: [], params: [], supportsDryRun: false, requiresConfirmation: false, needsHostRunner: false,
  },
  {
    id: 'rls.verify',
    label: 'Vérifier le RLS',
    description: 'Contrôle que les tables multi-tenant portent bien leurs politiques d’isolation (org/société).',
    category: 'securite', danger: 'safe', scope: 'both',
    warnings: [], params: [], supportsDryRun: false, requiresConfirmation: false, needsHostRunner: false,
  },
  {
    id: 'db.backup',
    label: 'Sauvegarde de la base',
    description: 'Déclenche une sauvegarde compressée (pg_dump) via le script de sauvegarde configuré.',
    category: 'donnees', danger: 'caution', scope: 'instance',
    warnings: ['Peut solliciter la base pendant la durée du dump.', 'Nécessite un runner hôte configuré (désactivé par défaut).'],
    params: [{ key: 'label', label: 'Étiquette (facultatif)', type: 'string', placeholder: 'ex. avant-migration' }],
    supportsDryRun: true, requiresConfirmation: false, needsHostRunner: true,
  },
  {
    id: 'db.restore',
    label: 'Restauration de la base',
    description: 'Restaure la base depuis une sauvegarde. ÉCRASE les données actuelles.',
    category: 'donnees', danger: 'danger', scope: 'instance',
    warnings: ['IRRÉVERSIBLE : écrase toutes les données actuelles.', 'Coupe l’accès pendant la restauration.', 'Nécessite un runner hôte configuré.'],
    params: [{ key: 'file', label: 'Fichier de sauvegarde', type: 'string', required: true, placeholder: 'nom du dump' }],
    supportsDryRun: true, requiresConfirmation: true, confirmToken: 'RESTAURER', needsHostRunner: true,
  },
  {
    id: 'demo.reseed',
    label: 'Réinitialiser les données de démo',
    description: 'Rejoue le seed de démonstration (comptes/sociétés de démo). À usage hors production.',
    category: 'maintenance', danger: 'danger', scope: 'instance',
    warnings: ['Réinitialise les données de démonstration.', 'À ne pas exécuter sur une instance de production.'],
    params: [], supportsDryRun: true, requiresConfirmation: true, confirmToken: 'RESEED', needsHostRunner: true,
  },
  {
    id: 'app.restart',
    label: 'Redémarrer le service applicatif',
    description: 'Redémarre le conteneur/serveur applicatif (coupe brièvement l’accès).',
    category: 'maintenance', danger: 'danger', scope: 'both',
    warnings: ['Coupe l’accès le temps du redémarrage.', 'Nécessite un runner hôte configuré.'],
    params: [], supportsDryRun: false, requiresConfirmation: true, confirmToken: 'REDEMARRER', needsHostRunner: true,
  },
];

export function getOp(id: string): OpDef | undefined {
  return OPS_CATALOG.find((o) => o.id === id);
}

export interface OpValidation {
  ok: boolean;
  errors: string[];
}

/** Valide les paramètres fournis pour une opération (présence des requis, types simples). */
export function validateOpParams(op: OpDef, input: Record<string, unknown>): OpValidation {
  const errors: string[] = [];
  for (const p of op.params) {
    const v = input[p.key];
    const empty = v === undefined || v === null || v === '';
    if (p.required && empty) { errors.push(`Paramètre requis : ${p.label}.`); continue; }
    if (empty) continue;
    if (p.type === 'number' && Number.isNaN(Number(v))) errors.push(`${p.label} doit être un nombre.`);
    if (p.type === 'select' && p.options && !p.options.some((o) => o.value === String(v))) errors.push(`${p.label} : valeur non autorisée.`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Détermine si une opération peut s'exécuter avec le contexte fourni.
 * `dryRun` court-circuite la confirmation (simulation) mais respecte la validation des paramètres.
 */
export function canExecute(
  op: OpDef,
  input: Record<string, unknown>,
  opts: { dryRun: boolean; confirmation?: string },
): OpValidation {
  const base = validateOpParams(op, input);
  const errors = [...base.errors];
  if (!opts.dryRun && op.requiresConfirmation) {
    if (!opts.confirmation || opts.confirmation.trim() !== op.confirmToken) {
      errors.push(`Confirmation requise : saisir « ${op.confirmToken} » pour exécuter.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
