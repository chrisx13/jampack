// Catalogue des formes juridiques françaises et de leurs RÈGLES (facturation / TVA / comptabilité).
// Pilote : les mentions légales obligatoires sur les pièces, le régime de TVA par défaut, et le type
// de comptabilité suggéré. Franco-français.
//
// ⚠️ RÉGLEMENTAIRE : ces règles synthétisent les obligations courantes ; elles doivent être
// **validées par un expert-comptable** avant émission réelle (cf. DOSSIER-CONFORMITE-FISCALE).
// Les valeurs par défaut restent surchargeables au niveau de la société (vatFranchise, vatOnPayments…).

export type LegalCategory = 'individuelle' | 'commerciale' | 'civile' | 'cooperative' | 'association' | 'autre';
/** Comptabilité : d'engagement (créances/dettes), de trésorerie (recettes-dépenses), ou micro (livre de recettes). */
export type AccountingRegime = 'engagement' | 'tresorerie' | 'micro';
export type VatDefault = 'franchise' | 'reel';
/** Registre d'immatriculation : RNE (Registre National des Entreprises, guichet unique depuis 2023). */
export type Immatriculation = 'RCS' | 'RNE' | 'RCS_RM' | 'aucune';

export interface LegalForm {
  key: string;
  label: string;
  category: LegalCategory;
  /** Personne morale (société) — sinon personne physique (entrepreneur individuel). */
  isMoral: boolean;
  /** Un capital social existe → mention « au capital de X € » sur les pièces. */
  hasCapital: boolean;
  immatriculation: Immatriculation;
  defaultVat: VatDefault;
  accounting: AccountingRegime;
  /** Suffixe/mention à accoler au nom (ex. « EI » pour l'entrepreneur individuel depuis 2022). */
  nameTag?: string;
  notes?: string;
}

// Regroupe EI et micro : la micro-entreprise est un régime de l'EI (défauts distincts : franchise + micro).
export const LEGAL_FORMS: LegalForm[] = [
  { key: 'EI', label: 'EI — Entreprise individuelle', category: 'individuelle', isMoral: false, hasCapital: false, immatriculation: 'RNE', defaultVat: 'reel', accounting: 'tresorerie', nameTag: 'EI' },
  { key: 'MICRO', label: 'Micro-entreprise (auto-entrepreneur)', category: 'individuelle', isMoral: false, hasCapital: false, immatriculation: 'RNE', defaultVat: 'franchise', accounting: 'micro', nameTag: 'EI', notes: 'Franchise en base fréquente (seuils) ; livre de recettes (+ registre des achats selon activité).' },
  { key: 'EURL', label: 'EURL — SARL unipersonnelle', category: 'commerciale', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'SARL', label: 'SARL — Société à responsabilité limitée', category: 'commerciale', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'SASU', label: 'SASU — SAS unipersonnelle', category: 'commerciale', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'SAS', label: 'SAS — Société par actions simplifiée', category: 'commerciale', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'SA', label: 'SA — Société anonyme', category: 'commerciale', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement', notes: 'Capital minimum 37 000 €.' },
  { key: 'SNC', label: 'SNC — Société en nom collectif', category: 'commerciale', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'SCI', label: 'SCI — Société civile immobilière', category: 'civile', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'franchise', accounting: 'engagement', notes: 'Location nue souvent hors champ TVA ; option possible.' },
  { key: 'SCM', label: 'SCM — Société civile de moyens', category: 'civile', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement', notes: 'Met des moyens à disposition de professionnels.' },
  { key: 'SCP', label: 'SCP — Société civile professionnelle', category: 'civile', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'SELARL', label: 'SELARL — Société d’exercice libéral à resp. limitée', category: 'commerciale', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'PROF_LIB', label: 'Profession libérale (BNC)', category: 'individuelle', isMoral: false, hasCapital: false, immatriculation: 'aucune', defaultVat: 'reel', accounting: 'tresorerie', notes: 'BNC : comptabilité de trésorerie ; mention AGA/OGA le cas échéant.' },
  { key: 'SCOP', label: 'SCOP — Société coopérative de production', category: 'cooperative', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'SCIC', label: 'SCIC — Société coopérative d’intérêt collectif', category: 'cooperative', isMoral: true, hasCapital: true, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'GIE', label: 'GIE — Groupement d’intérêt économique', category: 'autre', isMoral: true, hasCapital: false, immatriculation: 'RCS', defaultVat: 'reel', accounting: 'engagement' },
  { key: 'ASSO', label: 'Association loi 1901', category: 'association', isMoral: true, hasCapital: false, immatriculation: 'aucune', defaultVat: 'franchise', accounting: 'engagement', notes: 'Souvent non assujettie ; assujettissement si activités lucratives.' },
];

export function getLegalForm(key?: string | null): LegalForm | undefined {
  if (!key) return undefined;
  return LEGAL_FORMS.find((f) => f.key === key.toUpperCase());
}

/** Valeurs par défaut suggérées à la sélection d'une forme (surchargeables ensuite). */
export function legalFormDefaults(key: string): { vatFranchise: boolean; accounting: AccountingRegime; hasCapital: boolean; immatriculation: Immatriculation } | null {
  const f = getLegalForm(key);
  if (!f) return null;
  return { vatFranchise: f.defaultVat === 'franchise', accounting: f.accounting, hasCapital: f.hasCapital, immatriculation: f.immatriculation };
}

export interface SocieteLegalInfo {
  name: string;
  capital?: string | null;
  rcs?: string | null;
  siren?: string | null;
  vatFranchise?: boolean | null;
  vatOnPayments?: boolean | null;
  agaMember?: boolean | null; // membre d'une association/organisme de gestion agréé
}

/** Nom affiché avec le tag de forme requis (ex. « Dupont Jean — EI »). */
export function displayLegalName(form: LegalForm | undefined, name: string): string {
  if (form?.nameTag && !new RegExp(`\\b${form.nameTag}\\b`, 'i').test(name)) return `${name} — ${form.nameTag}`;
  return name;
}

/**
 * Mentions légales obligatoires à faire figurer sur les pièces (facture/devis), selon la forme.
 * Renvoie une liste de lignes prêtes à afficher (déjà filtrées des cas non applicables).
 */
export function legalFormMentions(form: LegalForm | undefined, info: SocieteLegalInfo): string[] {
  const out: string[] = [];

  // Dénomination + forme (+ capital pour les sociétés à capital).
  if (form) {
    const withCapital = form.hasCapital && info.capital ? `${form.key} au capital de ${info.capital}` : form.key;
    out.push(withCapital);
  }

  // Immatriculation.
  if (form?.immatriculation === 'RCS' && info.rcs) out.push(`RCS ${info.rcs}`);
  else if (form && (form.immatriculation === 'RNE') && info.siren) out.push(`SIREN ${info.siren} — RNE`);

  // TVA : franchise en base → mention obligatoire ; sinon rien (TVA appliquée normalement).
  if (info.vatFranchise) out.push('TVA non applicable, art. 293 B du CGI');

  // TVA sur les encaissements (mention obligatoire si option).
  if (info.vatOnPayments) out.push('TVA acquittée d’après les encaissements');

  // Micro/EI dispensé : indication d'insaisissabilité éventuelle non gérée ici.
  if (form?.key === 'MICRO') out.push('Dispense d’immatriculation au RCS et au RM le cas échéant');

  // Profession libérale membre d'une AGA/OGA.
  if (info.agaMember) out.push('Membre d’une association de gestion agréée, le règlement des honoraires par chèque ou carte bancaire est accepté');

  return out;
}
