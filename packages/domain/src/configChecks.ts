// Détection des défauts de configuration d'une instance — fonction PURE (testable).
// Le super-admin obtient un diagnostic ; la collecte des observations (env + BDD) se fait côté API.
// Portée selon le niveau : technicien → son instance ; général → agrégat flotte (à venir).

export type Severity = 'critical' | 'warning' | 'info';

export interface ConfigObservation {
  nodeEnv: string;
  authDevStub: boolean;        // auth de développement (dangereux en prod)
  corsRestricted: boolean;     // WEB_ORIGIN défini
  secretsEncryption: boolean;  // SECRETS_KEY défini
  aiEnabled: boolean;          // ANTHROPIC_API_KEY présent
  hostRunnerConfigured: boolean;
  backupConfigured: boolean;
  pendingOrFailedMigrations: number;
  rlsMissingTables: string[];
  societesMissingLegalIds: number; // sociétés sans SIREN/TVA
}

export interface ConfigFinding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  remediation: string;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const isProd = (env: string) => env === 'production';

/** Évalue les observations et renvoie les défauts détectés, triés par gravité. */
export function evaluateConfig(o: ConfigObservation): ConfigFinding[] {
  const f: ConfigFinding[] = [];
  const add = (id: string, severity: Severity, title: string, detail: string, remediation: string) => f.push({ id, severity, title, detail, remediation });

  if (o.authDevStub) {
    add('auth-dev-stub', isProd(o.nodeEnv) ? 'critical' : 'warning', 'Authentification de développement active',
      'AUTH_DEV_STUB contourne l’authentification réelle.', 'Désactiver AUTH_DEV_STUB et brancher Keycloak/OIDC.');
  }
  if (o.pendingOrFailedMigrations > 0) {
    add('migrations', 'critical', 'Migrations en attente ou en échec',
      `${o.pendingOrFailedMigrations} migration(s) non appliquée(s)/en échec.`, 'Exécuter « prisma migrate deploy » puis vérifier l’historique.');
  }
  if (o.rlsMissingTables.length > 0) {
    add('rls', 'critical', 'Isolation RLS incomplète',
      `Tables sans politique d’isolation : ${o.rlsMissingTables.join(', ')}.`, 'Rejouer rls.sql et vérifier via l’opération « Vérifier le RLS ».');
  }
  if (!o.secretsEncryption) {
    add('secrets-encryption', 'warning', 'Secrets non chiffrés au repos',
      'SECRETS_KEY absente : les clés sont stockées en clair.', 'Définir SECRETS_KEY (32 octets) pour activer le chiffrement AES-GCM.');
  }
  if (!o.corsRestricted && isProd(o.nodeEnv)) {
    add('cors', 'warning', 'CORS non restreint',
      'WEB_ORIGIN absent : l’API reflète l’origine (acceptable en dev seulement).', 'Définir WEB_ORIGIN sur la ou les origines du front.');
  }
  if (!o.backupConfigured) {
    add('backups', 'warning', 'Sauvegardes non configurées',
      'Aucun runner de sauvegarde configuré.', 'Planifier scripts/db-backup.sh et un stockage hors serveur.');
  }
  if (o.societesMissingLegalIds > 0) {
    add('legal-ids', 'warning', 'Identifiants légaux manquants',
      `${o.societesMissingLegalIds} société(s) sans SIREN/TVA.`, 'Renseigner SIREN/SIRET/TVA dans Administration ▸ Société.');
  }
  if (!o.aiEnabled) {
    add('ai-disabled', 'info', 'Enrichissement IA désactivé',
      'ANTHROPIC_API_KEY absente : reconnaissance de documents en niveau gratuit uniquement.', 'Renseigner ANTHROPIC_API_KEY pour activer l’IA (option).');
  }
  if (!o.hostRunnerConfigured) {
    add('host-runner', 'info', 'Runner hôte désactivé',
      'Les opérations hôte (sauvegarde/restauration/redémarrage) ne sont pas exécutables.', 'Configurer OPS_HOST_RUNNER pour activer ces opérations.');
  }

  return f.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Compte les défauts par gravité (pour un badge de synthèse). */
export function summarizeFindings(findings: ConfigFinding[]): { critical: number; warning: number; info: number; total: number } {
  const s = { critical: 0, warning: 0, info: 0, total: findings.length };
  for (const x of findings) s[x.severity]++;
  return s;
}
