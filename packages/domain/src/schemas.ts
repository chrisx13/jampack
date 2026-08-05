import { z } from 'zod';

export const byId = z.object({ id: z.string().min(1) });
export type ById = z.infer<typeof byId>;

// ── Notes de vue (pense-bêtes partagés, historisés, déplaçables) ──
/** Teintes proposées pour un pense-bête (classes de thème, pas de valeur brute côté domaine). */
export const NOTE_COLORS = ['amber', 'blue', 'green', 'pink', 'slate'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const byViewKey = z.object({ viewKey: z.string().min(1).max(64) });
export const viewNoteCreate = z.object({
  viewKey: z.string().min(1).max(64),
  content: z.string().max(2000).default(''),
  color: z.enum(NOTE_COLORS).default('amber'),
  x: z.number().int().min(0).max(20000).default(24),
  y: z.number().int().min(0).max(20000).default(24),
});
export const viewNoteEdit = z.object({ id: z.string().min(1), content: z.string().max(2000) });
export const viewNoteMove = z.object({ id: z.string().min(1), x: z.number().int().min(0).max(20000), y: z.number().int().min(0).max(20000) });
export const viewNoteColor = z.object({ id: z.string().min(1), color: z.enum(NOTE_COLORS) });

/**
 * Mentions légales de paiement obligatoires sur une facture (LME — art. L441-10 C. com.) :
 * taux des pénalités de retard et indemnité forfaitaire de recouvrement de 40 €.
 * `penaltyRate` : formulation du taux applicable (défaut : trois fois le taux d'intérêt légal).
 */
export function lmePaymentMention(penaltyRate?: string | null): string {
  const rate = (penaltyRate && penaltyRate.trim()) || "trois fois le taux d'intérêt légal";
  return `En cas de retard de paiement, application de pénalités au taux de ${rate}, ` +
    `ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce). ` +
    `Pas d'escompte pour paiement anticipé.`;
}

// ── Identifiants légaux français (SIREN / SIRET / TVA intracommunautaire) ──
/** Ne conserve que les chiffres d'une saisie (espaces/points tolérés). */
const digitsOnly = (s: string) => s.replace(/\D/g, '');

/** Clé de Luhn (SIREN à 9 chiffres, SIRET à 14) — algorithme officiel INSEE. */
function luhnValid(num: string): boolean {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = num.charCodeAt(num.length - 1 - i) - 48; // chiffre depuis la droite
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Vrai si `siren` est un SIREN valide (9 chiffres + clé de Luhn). */
export function isValidSiren(siren?: string | null): boolean {
  if (!siren) return false;
  const s = digitsOnly(siren);
  return s.length === 9 && luhnValid(s);
}

/** Vrai si `siret` est un SIRET valide (14 chiffres + clé de Luhn). */
export function isValidSiret(siret?: string | null): boolean {
  if (!siret) return false;
  const s = digitsOnly(siret);
  return s.length === 14 && luhnValid(s);
}

/**
 * Calcule le n° de TVA intracommunautaire français à partir du SIREN (règle DGFiP) :
 * « FR » + clé à 2 chiffres + SIREN, où clé = (12 + 3 × (SIREN mod 97)) mod 97.
 * Renvoie `null` si le SIREN est invalide.
 */
export function frTvaNumber(siren?: string | null): string | null {
  if (!isValidSiren(siren)) return null;
  const s = digitsOnly(siren!);
  const key = (12 + 3 * (Number(s) % 97)) % 97;
  return `FR${String(key).padStart(2, '0')}${s}`;
}

// ── Suivi du temps (facturation au temps) ──
export const timeEntryCreate = z.object({
  date: z.string(),
  description: z.string().min(1).max(200),
  minutes: z.number().int().min(1),
  companyId: z.string().min(1),
  opportunityId: z.string().nullable().optional(),
  hourlyRateHt: z.number().min(0),
  billable: z.boolean().default(true),
});
export const timeEntryUpdate = timeEntryCreate.partial().extend({ id: z.string().min(1) });

/** Montant HT d'un temps saisi : (minutes / 60) × taux horaire, arrondi au centime. */
export function timeEntryAmountHt(minutes: number, hourlyRateHt: number): number {
  return Math.round((minutes / 60) * hourlyRateHt * 100) / 100;
}
/** Durée « 1h30 » à partir de minutes. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}min`;
}

// ── Grille tarifaire (prix par quantité / par client) ──
export const priceRuleCreate = z.object({
  productId: z.string().min(1),
  companyId: z.string().nullable().optional(), // null = tous les clients
  minQuantity: z.number().min(0).default(1),
  unitPriceHt: z.number().min(0),
});

/**
 * Résout le prix unitaire HT applicable selon la grille tarifaire :
 * priorité au tarif **client** (vs générique), puis au **palier de quantité** le plus élevé
 * atteint, puis au prix le plus bas. Renvoie `basePrice` si aucune règle ne s'applique.
 */
export function resolvePrice(
  rules: { companyId: string | null; minQuantity: number; unitPriceHt: number }[],
  opts: { companyId?: string | null; quantity: number },
  basePrice: number,
): number {
  const applicable = rules.filter((r) => (r.companyId == null || r.companyId === opts.companyId) && r.minQuantity <= opts.quantity);
  if (applicable.length === 0) return basePrice;
  applicable.sort((a, b) => {
    const ca = a.companyId ? 1 : 0, cb = b.companyId ? 1 : 0;
    if (ca !== cb) return cb - ca;                                    // tarif client d'abord
    if (a.minQuantity !== b.minQuantity) return b.minQuantity - a.minQuantity; // palier le plus élevé
    return a.unitPriceHt - b.unitPriceHt;                             // sinon le moins cher
  });
  return applicable[0].unitPriceHt;
}

// ── Notes de frais (dépenses salariés) ──
/** Catégories de frais → compte de charge PCG (classe 6) par défaut. */
export const EXPENSE_CATEGORIES = [
  { key: 'deplacement', label: 'Déplacement / transport', account: '625100' },
  { key: 'repas', label: 'Repas / restauration', account: '625600' },
  { key: 'hebergement', label: 'Hébergement', account: '625500' },
  { key: 'fournitures', label: 'Fournitures / petit matériel', account: '606400' },
  { key: 'peage', label: 'Péage / stationnement', account: '625800' },
  { key: 'autre', label: 'Autre', account: '628000' },
] as const;
export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORIES)[number]['key'];
export const expenseCategoryLabel = (k: string): string => EXPENSE_CATEGORIES.find((c) => c.key === k)?.label ?? k;
export const expenseCategoryAccount = (k: string): string => EXPENSE_CATEGORIES.find((c) => c.key === k)?.account ?? '628000';

const EXPENSE_KEYS = EXPENSE_CATEGORIES.map((c) => c.key) as [string, ...string[]];
export const expenseCreate = z.object({
  date: z.string(),
  category: z.enum(EXPENSE_KEYS),
  description: z.string().min(1).max(200),
  amountHt: z.number().min(0),
  taxRatePct: z.number().min(0).default(20),
  incurredById: z.string().nullable().optional(), // salarié concerné (défaut : l'auteur)
});
export const expenseUpdate = expenseCreate.partial().extend({ id: z.string().min(1) });

// ── Factures récurrentes (abonnements) ──
export const RECURRENCE_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
export const recurrenceLabel = (f: string): string =>
  ({ weekly: 'Hebdomadaire', monthly: 'Mensuelle', quarterly: 'Trimestrielle', yearly: 'Annuelle' }[f] ?? f);

/** Calcule la prochaine échéance à partir d'une date, d'une fréquence et d'un intervalle (≥ 1). */
export function nextOccurrence(from: string | Date, frequency: RecurrenceFrequency, interval = 1): Date {
  const d = new Date(from);
  const step = Math.max(1, Math.floor(interval));
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * step);
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + step);
  else if (frequency === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3 * step);
  else if (frequency === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + step);
  return d;
}

const recurringLineInput = z.object({
  productId: z.string().optional(),
  label: z.string().min(1),
  quantity: z.number(),
  unitPriceHt: z.number(),
  taxRatePct: z.number().min(0),
});
export const recurringCreate = z.object({
  companyId: z.string().min(1),
  label: z.string().min(1),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().min(1).default(1),
  nextRunAt: z.string(),
  active: z.boolean().default(true),
  paymentTermId: z.string().nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
  discountType: z.enum(['none', 'percent', 'amount']).default('none'),
  discountValue: z.number().min(0).default(0),
  lines: z.array(recurringLineInput).min(1),
});
export const recurringUpdate = recurringCreate.partial().extend({ id: z.string().min(1) });

// ── Coordonnées bancaires (IBAN / BIC) ──
/** Valide un IBAN (ISO 13616) par la clé de contrôle mod-97 (ISO 7064). Espaces tolérés. */
export function isValidIban(iban?: string | null): boolean {
  if (!iban) return false;
  const s = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  // Déplace les 4 premiers caractères à la fin, puis convertit les lettres (A=10 … Z=35).
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= 'A' && ch <= 'Z' ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const d of code) remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

/** Valide le format d'un BIC/SWIFT (ISO 9362) : 8 ou 11 caractères alphanumériques. */
export function isValidBic(bic?: string | null): boolean {
  if (!bic) return false;
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.replace(/\s+/g, '').toUpperCase());
}

/** Formate un IBAN par groupes de 4 pour l'affichage (ex. FR76 3000 6000 01…). */
export function formatIban(iban?: string | null): string {
  if (!iban) return '';
  return iban.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

// ── Tiers (Company : client et/ou fournisseur) ──
export const companyCreate = z.object({
  name: z.string().min(1),
  siren: z.string().optional(),
  siret: z.string().optional(),
  tvaNumber: z.string().optional(),
  doNotProspect: z.boolean().optional(),
  processingRestricted: z.boolean().optional(),
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  factorId: z.string().optional(),
  factorMandatory: z.boolean().optional(),
  paymentTermId: z.string().optional(),
});
export type CompanyCreate = z.infer<typeof companyCreate>;

export const companyUpdate = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  siren: z.string().nullable().optional(),
  siret: z.string().nullable().optional(),
  tvaNumber: z.string().nullable().optional(),
  doNotProspect: z.boolean().optional(),
  processingRestricted: z.boolean().optional(),
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  factorId: z.string().nullable().optional(),
  factorMandatory: z.boolean().optional(),
  paymentTermId: z.string().nullable().optional(),
});
export type CompanyUpdate = z.infer<typeof companyUpdate>;

// ── Référentiels : TVA ──
export const taxRateCreate = z.object({
  name: z.string().min(1),
  rate: z.number().min(0).max(100),
  isDefault: z.boolean().optional(),
});
export type TaxRateCreate = z.infer<typeof taxRateCreate>;

export const taxRateUpdate = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  rate: z.number().min(0).max(100).optional(),
  isDefault: z.boolean().optional(),
});
export type TaxRateUpdate = z.infer<typeof taxRateUpdate>;

// ── Look & feel (thème du compte) ──
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale attendue (#RRGGBB)');
export const themeColors = z.object({
  primary: hex,
  success: hex,
  info: hex,
  warning: hex,
  danger: hex,
});
export type ThemeColors = z.infer<typeof themeColors>;

export const DEFAULT_THEME: ThemeColors = {
  primary: '#4F46E5', // indigo-600
  success: '#10B981', // emerald-500
  info: '#0EA5E9', // sky-500
  warning: '#F59E0B', // amber-500
  danger: '#EF4444', // red-500
};

// ── Référentiels : catégories d'articles ──
export const productCategoryCreate = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
  position: z.number().int().optional(),
});
export type ProductCategoryCreate = z.infer<typeof productCategoryCreate>;

export const productCategoryUpdate = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  parentId: z.string().nullable().optional(),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type ProductCategoryUpdate = z.infer<typeof productCategoryUpdate>;

// ── Référentiels : articles & services ──
export const productCreate = z.object({
  name: z.string().min(1),
  reference: z.string().optional(),
  description: z.string().optional(),
  kind: z.enum(['bien', 'service']).optional(),
  unit: z.string().optional(),
  priceHt: z.number().nonnegative().optional(),
  reorderPoint: z.number().nonnegative().nullable().optional(),
  taxRateId: z.string().optional(),
  categoryId: z.string().optional(),
});
export type ProductCreate = z.infer<typeof productCreate>;

/**
 * Import CSV d'articles : colonnes `référence ; nom ; prix HT ; unité ; type`.
 * Séparateur `;` ou `,` ; décimale FR (virgule) tolérée ; en-tête ignoré ; nom obligatoire.
 * `type` accepte bien/service (défaut : bien). Retourne des lignes prêtes pour `productCreate`.
 */
export type ProductCsvRow = { reference?: string; name: string; priceHt?: number; unit?: string; kind: 'bien' | 'service' };
export function parseProductsCsv(text: string): ProductCsvRow[] {
  const out: ProductCsvRow[] = [];
  for (const raw of (text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = (line.includes(';') ? line.split(';') : line.split(',')).map((c) => c.trim());
    const [reference, name, priceRaw, unit, kindRaw] = cols;
    if (!name) continue; // ligne sans nom : en-tête ou vide
    const lname = name.toLowerCase();
    if (lname === 'nom' || lname === 'name' || lname === 'libellé' || lname === 'libelle') continue; // en-tête
    const priceClean = (priceRaw ?? '').replace(/\s/g, '').replace('€', '').replace(',', '.');
    const price = priceClean === '' ? undefined : Number(priceClean);
    const kind = (kindRaw ?? '').toLowerCase().startsWith('serv') ? 'service' : 'bien';
    out.push({
      reference: reference || undefined,
      name,
      priceHt: price != null && Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : undefined,
      unit: unit || undefined,
      kind,
    });
  }
  return out;
}

export const productUpdate = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  reference: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  kind: z.enum(['bien', 'service']).optional(),
  unit: z.string().optional(),
  priceHt: z.number().nonnegative().optional(),
  reorderPoint: z.number().nonnegative().nullable().optional(),
  taxRateId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});
export type ProductUpdate = z.infer<typeof productUpdate>;

/** Inventaire physique : quantité comptée d'un article dans un entrepôt → mouvement d'ajustement. */
export const stockInventory = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  countedQuantity: z.number().nonnegative(),
  note: z.string().optional(),
});
export type StockInventory = z.infer<typeof stockInventory>;

// ── Établissements (adresses d'un client) ──
const establishmentFields = {
  name: z.string().min(1),
  siret: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isHeadquarters: z.boolean().optional(),
  isBilling: z.boolean().optional(),
  isDelivery: z.boolean().optional(),
};

export const establishmentCreate = z.object({ companyId: z.string().min(1), ...establishmentFields });
export type EstablishmentCreate = z.infer<typeof establishmentCreate>;

export const establishmentUpdate = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  siret: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  isHeadquarters: z.boolean().optional(),
  isBilling: z.boolean().optional(),
  isDelivery: z.boolean().optional(),
});
export type EstablishmentUpdate = z.infer<typeof establishmentUpdate>;

// ── Contacts ──
export const contactCreate = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyId: z.string().optional(),
});
export type ContactCreate = z.infer<typeof contactCreate>;

export const contactUpdate = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
});
export type ContactUpdate = z.infer<typeof contactUpdate>;

// ── Opportunités ──
export const opportunityCreate = z.object({
  title: z.string().min(1),
  amount: z.number().nonnegative().optional(),
  stageId: z.string().min(1),
  companyId: z.string().optional(),
});
export type OpportunityCreate = z.infer<typeof opportunityCreate>;

export const opportunityUpdate = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  amount: z.number().nonnegative().nullable().optional(),
  stageId: z.string().min(1).optional(),
  companyId: z.string().nullable().optional(),
});
export type OpportunityUpdate = z.infer<typeof opportunityUpdate>;

/** Déplacement d'une opportunité dans le pipeline (kanban). */
export const opportunityMove = z.object({
  id: z.string().min(1),
  stageId: z.string().min(1),
});
export type OpportunityMove = z.infer<typeof opportunityMove>;

// ── Activités ──
export const ACTIVITY_TYPES = ['note', 'appel', 'email', 'rdv', 'tache'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: 'Note',
  appel: 'Appel',
  email: 'E-mail',
  rdv: 'Rendez-vous',
  tache: 'Tâche',
};
export function activityTypeLabel(type: string): string {
  return ACTIVITY_LABELS[type as ActivityType] ?? type;
}
/** Une activité « à faire » est en retard si elle a une échéance dépassée et n'est pas terminée. */
export function isActivityOverdue(a: { type: string; done: boolean; dueAt?: Date | string | null }, now = new Date()): boolean {
  if (a.type !== 'tache' || a.done || !a.dueAt) return false;
  return new Date(a.dueAt).getTime() < now.getTime();
}
export const activityCreate = z.object({
  type: z.enum(ACTIVITY_TYPES),
  content: z.string().min(1),
  dueAt: z.string().datetime().optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  opportunityId: z.string().optional(),
}).refine((a) => a.companyId || a.contactId || a.opportunityId, {
  message: 'Rattacher l’activité à un client, un contact ou une opportunité',
});
export type ActivityCreate = z.infer<typeof activityCreate>;

// ── Création d'une société ──
export const societeCreate = z.object({
  name: z.string().min(1),
  siren: z.string().optional(),
  siret: z.string().optional(),
  tvaNumber: z.string().optional(),
  city: z.string().optional(),
});
export type SocieteCreate = z.infer<typeof societeCreate>;

// ── Paramétrage société (facturation) ──
const optStr = z.string().max(2000).nullable().optional();
export const societeSettingsUpdate = z.object({
  name: z.string().min(1).optional(),
  siren: optStr, siret: optStr, tvaNumber: optStr,
  legalForm: optStr, capital: optStr, rcs: optStr, ape: optStr,
  addressLine1: optStr, addressLine2: optStr, postalCode: optStr, city: optStr,
  phone: optStr, email: optStr, website: optStr, logoUrl: optStr,
  legalMentions: optStr, cgv: optStr, penaltyRate: optStr, discountTerms: optStr,
  vatFranchise: z.boolean().optional(),
  vatOnPayments: z.boolean().optional(),
});
export type SocieteSettingsUpdate = z.infer<typeof societeSettingsUpdate>;

/** Mention obligatoire d'exonération en franchise en base de TVA (art. 293 B du CGI). */
export const VAT_FRANCHISE_MENTION = 'TVA non applicable, art. 293 B du CGI';

/** Mention obligatoire en cas d'autoliquidation de la TVA (TVA due par le preneur). */
export const VAT_REVERSE_CHARGE_MENTION = 'Autoliquidation — TVA due par le preneur (art. 283-2 du CGI)';

/** Mention obligatoire sous le régime « TVA sur les encaissements » (prestations de services). */
export const VAT_ON_PAYMENTS_MENTION = "TVA acquittée d'après les encaissements";

/** Mention d'escompte par défaut lorsque aucune condition n'est offerte (art. L441-10 C. com.). */
export const DISCOUNT_MENTION_NONE = "Pas d'escompte pour paiement anticipé";
/** Mention d'escompte à porter sur la facture : conditions saisies, ou mention par défaut « néant ». */
export function discountMention(terms?: string | null): string {
  const t = (terms ?? '').trim();
  return t ? `Escompte pour paiement anticipé : ${t}` : DISCOUNT_MENTION_NONE;
}

// ── Immobilisations & amortissement ──
export const fixedAssetCreate = z.object({
  name: z.string().min(1),
  accountCode: z.string().optional(),
  amountHt: z.number().positive(),
  acquisitionDate: z.string().min(1),
  durationYears: z.number().int().positive(),
});
export const fixedAssetUpdate = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  accountCode: z.string().nullable().optional(),
  amountHt: z.number().positive().optional(),
  acquisitionDate: z.string().optional(),
  durationYears: z.number().int().positive().optional(),
});

export type DepreciationRow = { year: number; annuity: number; cumulated: number; residual: number };
/**
 * Plan d'amortissement **linéaire** (prorata temporis au mois d'acquisition, base 12).
 * Le mois d'acquisition compte pour un mois entier ; la 1re annuité est réduite au prorata,
 * la dernière porte le solde. Retourne une ligne par exercice.
 */
export function depreciationSchedule(amountHt: number, durationYears: number, acquisitionDate: Date): DepreciationRow[] {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const annual = amountHt / durationYears;
  const startYear = acquisitionDate.getFullYear();
  const firstFraction = (13 - (acquisitionDate.getMonth() + 1)) / 12; // mois d'acquisition = 1er mois entier
  const rows: DepreciationRow[] = [];
  let cumulated = 0;
  for (let i = 0; cumulated < amountHt - 0.005 && i <= durationYears + 1; i++) {
    let annuity = r2(annual * (i === 0 ? firstFraction : 1));
    if (cumulated + annuity > amountHt) annuity = r2(amountHt - cumulated); // dernière annuité : solde
    cumulated = r2(cumulated + annuity);
    rows.push({ year: startYear + i, annuity, cumulated, residual: r2(amountHt - cumulated) });
  }
  return rows;
}

/** Niveaux de relance client (dunning). */
export const REMINDER_LEVELS = ['Relance 1 — rappel', 'Relance 2 — relance ferme', 'Relance 3 — mise en demeure'] as const;
export function reminderLevelLabel(level: number): string {
  if (level <= 0) return 'Aucune relance';
  return REMINDER_LEVELS[Math.min(level, REMINDER_LEVELS.length) - 1];
}
/** Corps de la lettre de relance selon le niveau (ton progressif). */
export function dunningMessage(level: number, opts: { number: string; amount: string; dueDate: string }): string {
  const l = Math.min(Math.max(level, 1), 3);
  const head = `Objet : ${reminderLevelLabel(l)} — facture ${opts.number}\n\n`;
  const common = `Notre facture ${opts.number}, échue le ${opts.dueDate}, d'un montant de ${opts.amount}, demeure impayée à ce jour.\n\n`;
  const tail =
    l === 1 ? `Nous vous remercions de bien vouloir procéder à son règlement dans les meilleurs délais. Si le paiement a été effectué entretemps, merci de ne pas tenir compte de ce rappel.`
    : l === 2 ? `Sauf régularisation sous huitaine, nous nous verrons contraints d'appliquer les pénalités de retard prévues ainsi que l'indemnité forfaitaire de recouvrement de 40 €.`
    : `À défaut de règlement sous 8 jours, cette lettre vaut mise en demeure et le dossier sera transmis au recouvrement contentieux, sans autre avis.`;
  return head + common + tail + '\n\nNous restons à votre disposition. Veuillez agréer nos salutations distinguées.';
}

export type BankStatementLine = { date: string; label: string; amount: number };
/**
 * Parse un relevé bancaire CSV (format FR usuel) : une ligne par écriture,
 * colonnes `date ; libellé ; montant` (séparateur `;` ou `,`, décimale `,`).
 * Le montant est **signé** du point de vue du titulaire : positif = encaissement, négatif = décaissement.
 * Les lignes sans montant numérique (en-tête) sont ignorées.
 */
export function parseBankStatementCsv(text: string): BankStatementLine[] {
  const out: BankStatementLine[] = [];
  for (const raw of (text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = (line.includes(';') ? line.split(';') : line.split(',')).map((c) => c.trim());
    if (cols.length < 2) continue;
    const rawAmount = cols[cols.length - 1].replace(/\s/g, '').replace('€', '').replace(',', '.');
    if (rawAmount === '') continue; // pas de montant (en-tête ou ligne vide)
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount)) continue; // en-tête ou ligne invalide
    out.push({ date: cols[0], label: cols.slice(1, -1).join(' ') || cols[0], amount: Math.round(amount * 100) / 100 });
  }
  return out;
}

// ── Adresses de la société (plusieurs) ──
export const societeAddressCreate = z.object({
  label: z.string().min(1),
  addressLine1: z.string().optional(), addressLine2: z.string().optional(),
  postalCode: z.string().optional(), city: z.string().optional(), country: z.string().optional(),
  isHeadquarters: z.boolean().optional(), isBilling: z.boolean().optional(), isDefault: z.boolean().optional(),
});
export const societeAddressUpdate = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  addressLine1: optStr, addressLine2: optStr, postalCode: optStr, city: optStr, country: optStr,
  isHeadquarters: z.boolean().optional(), isBilling: z.boolean().optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional(),
});
export type SocieteAddressCreate = z.infer<typeof societeAddressCreate>;

// ── Facturation : affactureurs / comptes bancaires / conditions de paiement ──
export const factorCreate = z.object({ name: z.string().min(1), iban: z.string().optional(), bic: z.string().optional() });
export const factorUpdate = z.object({ id: z.string().min(1), name: z.string().min(1).optional(), iban: optStr, bic: optStr, isActive: z.boolean().optional() });
export type FactorCreate = z.infer<typeof factorCreate>;

export const bankAccountCreate = z.object({ label: z.string().min(1), iban: z.string().min(1), bic: z.string().optional(), isDefault: z.boolean().optional() });
export const bankAccountUpdate = z.object({ id: z.string().min(1), label: z.string().min(1).optional(), iban: z.string().min(1).optional(), bic: optStr, isDefault: z.boolean().optional(), isActive: z.boolean().optional() });
export type BankAccountCreate = z.infer<typeof bankAccountCreate>;

export const paymentTermCreate = z.object({ label: z.string().min(1), days: z.number().int().min(0).optional(), isDefault: z.boolean().optional() });
export const paymentTermUpdate = z.object({ id: z.string().min(1), label: z.string().min(1).optional(), days: z.number().int().min(0).optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional() });
export type PaymentTermCreate = z.infer<typeof paymentTermCreate>;

// ── Facturation ──
export const invoiceLineInput = z.object({
  productId: z.string().optional(),
  label: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceHt: z.number().nonnegative(),
  taxRatePct: z.number().min(0).max(100),
  position: z.number().int().optional(),
});
export type InvoiceLineInput = z.infer<typeof invoiceLineInput>;

export const invoiceCreate = z.object({
  companyId: z.string().min(1),
  establishmentId: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  factorId: z.string().nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
  paymentTermId: z.string().nullable().optional(),
  vatReverseCharge: z.boolean().optional(),
  customerReference: z.string().max(80).nullable().optional(),
  discountType: z.enum(['none', 'percent', 'amount']).optional(),
  discountValue: z.number().min(0).optional(),
  paymentUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  lines: z.array(invoiceLineInput).default([]),
});
export type InvoiceCreate = z.infer<typeof invoiceCreate>;

export const invoiceUpdate = z.object({
  id: z.string().min(1),
  companyId: z.string().optional(),
  establishmentId: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  factorId: z.string().nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
  paymentTermId: z.string().nullable().optional(),
  vatReverseCharge: z.boolean().optional(),
  customerReference: z.string().max(80).nullable().optional(),
  discountType: z.enum(['none', 'percent', 'amount']).optional(),
  discountValue: z.number().min(0).optional(),
  paymentUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  lines: z.array(invoiceLineInput).optional(),
});
export type InvoiceUpdate = z.infer<typeof invoiceUpdate>;

/**
 * Type de pièce de vente et sémantique associée — source unique partagée
 * par le serveur (numérotation, statuts) et l'UI (libellés, actions).
 */
export type SalesDocType = 'devis' | 'facture' | 'avoir';

export interface SalesDocMeta {
  docType: SalesDocType;
  subject: string;        // sujet CASL (Quote | Invoice | CreditNote)
  seqType: string;        // clé de NumberSequence (devis | facture | avoir)
  issuedStatus: string;   // statut après « validation »/émission
  singular: string;
  plural: string;
}

export const SALES_DOCS: Record<SalesDocType, SalesDocMeta> = {
  devis:   { docType: 'devis',   subject: 'Quote',      seqType: 'devis',   issuedStatus: 'sent',      singular: 'Devis',  plural: 'Devis' },
  facture: { docType: 'facture', subject: 'Invoice',    seqType: 'facture', issuedStatus: 'validated', singular: 'Facture', plural: 'Factures' },
  avoir:   { docType: 'avoir',   subject: 'CreditNote', seqType: 'avoir',   issuedStatus: 'validated', singular: 'Avoir',  plural: 'Avoirs' },
};

// ── Règlements (encaissements) ──
export const PAYMENT_METHODS = ['virement', 'cheque', 'cb', 'especes', 'prelevement'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  virement: 'Virement', cheque: 'Chèque', cb: 'Carte bancaire', especes: 'Espèces', prelevement: 'Prélèvement',
};

export const paymentCreate = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
});
export type PaymentCreate = z.infer<typeof paymentCreate>;

/** Règlement fournisseur (décaissement) — symétrique du règlement client. */
export const supplierPaymentCreate = z.object({
  supplierInvoiceId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
});
export type SupplierPaymentCreate = z.infer<typeof supplierPaymentCreate>;

// ── Stock : entrepôts & mouvements ──
export const STOCK_KINDS = ['entree', 'sortie', 'ajustement'] as const;
export type StockKind = (typeof STOCK_KINDS)[number];
export const STOCK_KIND_LABELS: Record<StockKind, string> = { entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement' };

export const warehouseCreate = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  addressLine1: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export const warehouseUpdate = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  code: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type WarehouseCreate = z.infer<typeof warehouseCreate>;

export const stockMovementCreate = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  kind: z.enum(STOCK_KINDS),
  // Quantité saisie (positive pour entrée/sortie ; signée autorisée pour un ajustement).
  quantity: z.number().refine((v) => v !== 0, 'Quantité non nulle attendue'),
  unitCost: z.number().nonnegative().optional(),
  lotNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  note: z.string().optional(),
  date: z.string().optional(),
});
export type StockMovementCreate = z.infer<typeof stockMovementCreate>;

/**
 * Sérialise les niveaux de stock en CSV (séparateur `;`, décimale FR).
 * Colonnes : Référence ; Article ; Entrepôt ; Quantité ; Unité. Échappe `;`/`"`/retours ligne.
 */
export type StockLevelRow = { reference?: string | null; productName: string; warehouseName: string; quantity: number; unit?: string | null };
export function stockLevelsCsv(rows: StockLevelRow[]): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const fr = (n: number) => (Math.round(n * 1000) / 1000).toString().replace('.', ',');
  const head = 'Référence;Article;Entrepôt;Quantité;Unité';
  const lines = rows.map((r) => [esc(r.reference ?? ''), esc(r.productName), esc(r.warehouseName), fr(r.quantity), esc(r.unit ?? '')].join(';'));
  return [head, ...lines].join('\n');
}

/**
 * Sérialise le journal d'audit en CSV (séparateur `;`). Colonnes : Date ; Utilisateur ; Action ; Référence.
 * `at` au format ISO → date+heure FR. Échappe `;`/`"`/retours ligne.
 */
export type AuditCsvRow = { at: string | Date; userEmail: string; action: string; ref?: string | null };
export function auditLogCsv(rows: AuditCsvRow[]): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const dt = (d: string | Date) => {
    const x = new Date(d);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(x.getUTCDate())}/${p(x.getUTCMonth() + 1)}/${x.getUTCFullYear()} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`;
  };
  const head = 'Date;Utilisateur;Action;Référence';
  const lines = rows.map((r) => [dt(r.at), esc(r.userEmail), esc(r.action), esc(r.ref ?? '')].join(';'));
  return [head, ...lines].join('\n');
}

/**
 * Sérialise une balance comptable en CSV (séparateur `;`, décimale FR).
 * Colonnes : Compte ; Libellé ; Débit ; Crédit ; Solde. Échappe `;`/`"`/retours ligne.
 */
export type BalanceCsvRow = { code: string; name: string; debit: number; credit: number; solde: number };
export function balanceCsv(rows: BalanceCsvRow[]): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const fr = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  const head = 'Compte;Libellé;Débit;Crédit;Solde';
  const lines = rows.map((r) => [esc(r.code), esc(r.name), fr(r.debit), fr(r.credit), fr(r.solde)].join(';'));
  return [head, ...lines].join('\n');
}

/**
 * Sérialise un grand livre de compte en CSV (séparateur `;`, décimale FR, date JJ/MM/AAAA).
 * Colonnes : Date ; Journal ; Référence ; Libellé ; Débit ; Crédit ; Lettrage ; Solde.
 */
export type LedgerCsvRow = { date: string | Date | null; journal: string; reference?: string | null; label: string; debit: number; credit: number; letter?: string | null; solde: number };
export function ledgerCsv(rows: LedgerCsvRow[]): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const fr = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  const d = (v: string | Date | null) => {
    if (!v) return '';
    const x = new Date(v);
    const p = (k: number) => String(k).padStart(2, '0');
    return `${p(x.getUTCDate())}/${p(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
  };
  const head = 'Date;Journal;Référence;Libellé;Débit;Crédit;Lettrage;Solde';
  const lines = rows.map((r) => [d(r.date), esc(r.journal), esc(r.reference ?? ''), esc(r.label), fr(r.debit), fr(r.credit), esc(r.letter ?? ''), fr(r.solde)].join(';'));
  return [head, ...lines].join('\n');
}

/**
 * Génère un calendrier iCalendar (RFC 5545) d'événements « journée » (VALUE=DATE)
 * importable dans Outlook/Google Agenda. `date` au format ISO ; `stamp` = DTSTAMP fixe (déterminisme).
 */
export type IcsEvent = { uid: string; date: string | Date; summary: string };
export function buildAgendaIcs(events: IcsEvent[], stamp = '20260101T000000Z'): string {
  const day = (d: string | Date) => {
    const dt = new Date(d);
    return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
  };
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JAMPACK//Agenda//FR', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@jampack`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(e.date)}`, `SUMMARY:${esc(e.summary)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Un devis émis est expiré si sa date de validité est dépassée (offre caduque). */
export function isQuoteExpired(q: { status: string; validUntil?: Date | string | null }, now = new Date()): boolean {
  if (q.status !== 'sent' || !q.validUntil) return false;
  return new Date(q.validUntil).getTime() < now.getTime();
}
/** Jours restants avant expiration d'un devis émis (négatif si déjà expiré) ; null si sans date/valide. */
export function quoteDaysToExpiry(q: { status: string; validUntil?: Date | string | null }, now = new Date()): number | null {
  if (q.status !== 'sent' || !q.validUntil) return null;
  return Math.ceil((new Date(q.validUntil).getTime() - now.getTime()) / 86400000);
}

/** Une commande fournisseur est en retard si envoyée (non réceptionnée) et sa date prévue est dépassée. */
export function isPurchaseOrderOverdue(po: { status: string; expectedDate?: Date | string | null }, now = new Date()): boolean {
  if (po.status !== 'sent' || !po.expectedDate) return false;
  return new Date(po.expectedDate).getTime() < now.getTime();
}
/** Nombre de jours de retard (positif) d'une commande fournisseur ; 0 si non applicable. */
export function purchaseOrderDaysLate(po: { status: string; expectedDate?: Date | string | null }, now = new Date()): number {
  if (!isPurchaseOrderOverdue(po, now)) return 0;
  return Math.floor((now.getTime() - new Date(po.expectedDate as string | Date).getTime()) / 86400000);
}

// ── Transfert inter-entrepôts (sortie source + entrée destination, atomique) ──
export const stockTransfer = z.object({
  productId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.number().positive('Quantité à transférer strictement positive'),
  lotNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  note: z.string().optional(),
  date: z.string().optional(),
}).refine((t) => t.fromWarehouseId !== t.toWarehouseId, {
  message: 'Les entrepôts source et destination doivent différer',
  path: ['toWarehouseId'],
});
export type StockTransfer = z.infer<typeof stockTransfer>;

// ── Achats : commandes fournisseurs ──
export const PO_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', sent: 'Envoyée', partial: 'Réception partielle', received: 'Réceptionnée', cancelled: 'Annulée',
};

export const poLineInput = z.object({
  productId: z.string().optional(),
  label: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceHt: z.number().nonnegative(),
  position: z.number().int().optional(),
});
export type PoLineInput = z.infer<typeof poLineInput>;

export const purchaseOrderCreate = z.object({
  supplierId: z.string().min(1),
  warehouseId: z.string().optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(poLineInput).default([]),
});
export type PurchaseOrderCreate = z.infer<typeof purchaseOrderCreate>;

/** Réception partielle : quantités reçues par ligne de commande (livraisons échelonnées). */
export const purchaseReceipt = z.object({
  id: z.string().min(1),
  lines: z.array(z.object({ lineId: z.string().min(1), quantity: z.number().nonnegative() })).min(1),
});
export type PurchaseReceipt = z.infer<typeof purchaseReceipt>;

export const purchaseOrderUpdate = z.object({
  id: z.string().min(1),
  supplierId: z.string().optional(),
  warehouseId: z.string().nullable().optional(),
  orderDate: z.string().nullable().optional(),
  expectedDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(poLineInput).optional(),
});
export type PurchaseOrderUpdate = z.infer<typeof purchaseOrderUpdate>;

// ── Achats : factures fournisseurs (comptes à payer) ──
export const supplierInvoiceLineInput = z.object({
  label: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceHt: z.number().nonnegative(),
  taxRatePct: z.number().min(0).max(100),
  position: z.number().int().optional(),
});
export const supplierInvoiceCreate = z.object({
  supplierId: z.string().min(1),
  purchaseOrderId: z.string().nullable().optional(),
  reference: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(supplierInvoiceLineInput).default([]),
});
export type SupplierInvoiceCreate = z.infer<typeof supplierInvoiceCreate>;

export const supplierInvoiceUpdate = z.object({
  id: z.string().min(1),
  supplierId: z.string().optional(),
  purchaseOrderId: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(supplierInvoiceLineInput).optional(),
});
export type SupplierInvoiceUpdate = z.infer<typeof supplierInvoiceUpdate>;

// ── Comptabilité : plan comptable, journaux, écritures ──
export const JOURNAL_TYPES = ['vente', 'achat', 'banque', 'od'] as const;
export type JournalType = (typeof JOURNAL_TYPES)[number];
export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = { vente: 'Ventes', achat: 'Achats', banque: 'Banque', od: 'Opérations diverses' };

export const accountCreate = z.object({ code: z.string().min(1), name: z.string().min(1) });
export const accountUpdate = z.object({ id: z.string().min(1), code: z.string().min(1).optional(), name: z.string().min(1).optional(), isActive: z.boolean().optional() });
export type AccountCreate = z.infer<typeof accountCreate>;

export const journalCreate = z.object({ code: z.string().min(1), name: z.string().min(1), type: z.enum(JOURNAL_TYPES) });
export type JournalCreate = z.infer<typeof journalCreate>;

export const journalEntryLineInput = z.object({
  accountId: z.string().min(1),
  label: z.string().optional(),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
});
export const journalEntryCreate = z
  .object({
    journalId: z.string().min(1),
    date: z.string(),
    reference: z.string().optional(),
    label: z.string().min(1),
    lines: z.array(journalEntryLineInput).min(2),
  })
  .refine((e) => {
    const d = e.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const c = e.lines.reduce((s, l) => s + (l.credit || 0), 0);
    return Math.abs(d - c) < 0.005 && d > 0;
  }, { message: "L'écriture doit être équilibrée (débit = crédit) et non nulle." });
export type JournalEntryCreate = z.infer<typeof journalEntryCreate>;

/** Plan comptable minimal (PCG) proposé par défaut à une société. */
/** Plan comptable général (PCG) — jeu standard usuel pour une TPE/PME française (classes 1 à 7). */
export const PCG_STANDARD: { code: string; name: string }[] = [
  // Classe 1 — Capitaux
  { code: '101000', name: 'Capital' },
  { code: '106000', name: 'Réserves' },
  { code: '120000', name: 'Résultat de l’exercice (bénéfice)' },
  { code: '129000', name: 'Résultat de l’exercice (perte)' },
  { code: '164000', name: 'Emprunts auprès des établissements de crédit' },
  // Classe 2 — Immobilisations
  { code: '205000', name: 'Concessions, brevets, logiciels' },
  { code: '215000', name: 'Installations techniques, matériel et outillage' },
  { code: '218300', name: 'Matériel informatique' },
  { code: '218400', name: 'Mobilier' },
  { code: '280500', name: 'Amortissements des immobilisations incorporelles' },
  { code: '281800', name: 'Amortissements des autres immobilisations corporelles' },
  // Classe 4 — Tiers
  { code: '401000', name: 'Fournisseurs' },
  { code: '404000', name: 'Fournisseurs d’immobilisations' },
  { code: '408000', name: 'Fournisseurs — factures non parvenues' },
  { code: '411000', name: 'Clients' },
  { code: '416000', name: 'Clients douteux ou litigieux' },
  { code: '418000', name: 'Clients — factures à établir' },
  { code: '421000', name: 'Personnel — rémunérations dues' },
  { code: '431000', name: 'Sécurité sociale' },
  { code: '445660', name: 'TVA déductible' },
  { code: '445620', name: 'TVA déductible sur immobilisations' },
  { code: '445710', name: 'TVA collectée' },
  { code: '445510', name: 'TVA à décaisser' },
  { code: '445670', name: 'Crédit de TVA à reporter' },
  { code: '447000', name: 'Autres impôts, taxes et versements assimilés' },
  { code: '455000', name: 'Associés — comptes courants' },
  // Classe 5 — Financier
  { code: '512000', name: 'Banque' },
  { code: '514000', name: 'Chèques postaux' },
  { code: '530000', name: 'Caisse' },
  { code: '580000', name: 'Virements internes' },
  // Classe 6 — Charges
  { code: '601000', name: 'Achats de matières premières' },
  { code: '607000', name: 'Achats de marchandises' },
  { code: '606300', name: 'Fournitures d’entretien et petit équipement' },
  { code: '606400', name: 'Fournitures administratives' },
  { code: '613000', name: 'Locations' },
  { code: '615000', name: 'Entretien et réparations' },
  { code: '616000', name: 'Primes d’assurance' },
  { code: '622600', name: 'Honoraires' },
  { code: '623000', name: 'Publicité, publications' },
  { code: '625000', name: 'Déplacements, missions et réceptions' },
  { code: '626000', name: 'Frais postaux et de télécommunications' },
  { code: '627000', name: 'Services bancaires' },
  { code: '635000', name: 'Impôts et taxes' },
  { code: '641000', name: 'Rémunérations du personnel' },
  { code: '645000', name: 'Charges de sécurité sociale et de prévoyance' },
  { code: '661000', name: 'Charges d’intérêts' },
  { code: '681000', name: 'Dotations aux amortissements' },
  // Classe 7 — Produits
  { code: '701000', name: 'Ventes de produits finis' },
  { code: '706000', name: 'Prestations de services' },
  { code: '707000', name: 'Ventes de marchandises' },
  { code: '708000', name: 'Produits des activités annexes' },
  { code: '758000', name: 'Produits divers de gestion courante' },
  { code: '764000', name: 'Produits financiers' },
];

/** @deprecated conservé pour compatibilité — utiliser {@link PCG_STANDARD}. */
export const PCG_MINIMAL = PCG_STANDARD;


/** Totaux HT / TVA / TTC (arrondis au centime, ligne par ligne). */
/**
 * Remise globale (pied de pièce) : type et valeur.
 * - `none` : aucune remise ;
 * - `percent` : pourcentage (0–100) appliqué à chaque ligne (la TVA par taux reste exacte) ;
 * - `amount` : montant HT réparti proportionnellement sur les lignes (converti en % effectif).
 */
export type DiscountOpts = { discountType?: 'none' | 'percent' | 'amount' | null; discountValue?: number | null };

/** Facteur de remise effectif (0..1 retiré) pour un brut HT donné. */
export function effectiveDiscountFactor(grossHt: number, opts?: DiscountOpts): number {
  if (!opts || !opts.discountType || opts.discountType === 'none') return 1;
  const v = Number(opts.discountValue) || 0;
  if (v <= 0) return 1;
  if (opts.discountType === 'percent') return 1 - Math.min(v, 100) / 100;
  if (opts.discountType === 'amount' && grossHt > 0) return 1 - Math.min(v / grossHt, 1);
  return 1;
}

/**
 * Lignes d'une **facture d'acompte** : un acompte de `pct` % réparti **par taux de TVA**
 * (la TVA de l'acompte est due à l'encaissement, art. 269 CGI). Prend en compte une éventuelle
 * remise globale (base nette). Renvoie une ligne par taux présent dans la pièce.
 */
export function depositLines(
  lines: { quantity: number; unitPriceHt: number; taxRatePct: number }[],
  opts: DiscountOpts | undefined,
  pct: number,
): { label: string; quantity: number; unitPriceHt: number; taxRatePct: number }[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let grossHt = 0;
  for (const l of lines) grossHt += r2(l.quantity * l.unitPriceHt);
  const factor = effectiveDiscountFactor(r2(grossHt), opts);
  const f = Math.min(Math.max(pct, 0), 100) / 100;
  const byRate = new Map<number, number>();
  for (const l of lines) {
    const net = r2(r2(l.quantity * l.unitPriceHt) * factor);
    byRate.set(l.taxRatePct, r2((byRate.get(l.taxRatePct) ?? 0) + net));
  }
  return [...byRate.entries()]
    .filter(([, base]) => base !== 0)
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ label: `Acompte ${pct} % (TVA ${rate} %)`, quantity: 1, unitPriceHt: r2(base * f), taxRatePct: rate }));
}

export function computeInvoiceTotals(
  lines: { quantity: number; unitPriceHt: number; taxRatePct: number }[],
  opts?: DiscountOpts
): { totalHt: number; totalTva: number; totalTtc: number; grossHt: number; discountHt: number } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let grossHt = 0;
  for (const l of lines) grossHt += r2(l.quantity * l.unitPriceHt);
  grossHt = r2(grossHt);
  const factor = effectiveDiscountFactor(grossHt, opts);
  let totalHt = 0;
  let totalTva = 0;
  for (const l of lines) {
    const lineHt = r2(r2(l.quantity * l.unitPriceHt) * factor);
    totalHt += lineHt;
    totalTva += r2(lineHt * (l.taxRatePct / 100));
  }
  totalHt = r2(totalHt);
  totalTva = r2(totalTva);
  return { totalHt, totalTva, totalTtc: r2(totalHt + totalTva), grossHt, discountHt: r2(grossHt - totalHt) };
}
