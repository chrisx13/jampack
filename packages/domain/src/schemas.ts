import { z } from 'zod';

export const byId = z.object({ id: z.string().min(1) });
export type ById = z.infer<typeof byId>;

// ── Tiers (Company : client et/ou fournisseur) ──
export const companyCreate = z.object({
  name: z.string().min(1),
  siren: z.string().optional(),
  siret: z.string().optional(),
  tvaNumber: z.string().optional(),
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
export const activityCreate = z.object({
  type: z.enum(['note', 'appel', 'email', 'rdv', 'tache']),
  content: z.string().min(1),
  dueAt: z.string().datetime().optional(),
  contactId: z.string().optional(),
  opportunityId: z.string().optional(),
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
  legalMentions: optStr, cgv: optStr,
});
export type SocieteSettingsUpdate = z.infer<typeof societeSettingsUpdate>;

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
  note: z.string().optional(),
  date: z.string().optional(),
});
export type StockMovementCreate = z.infer<typeof stockMovementCreate>;

// ── Achats : commandes fournisseurs ──
export const PO_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', sent: 'Envoyée', received: 'Réceptionnée', cancelled: 'Annulée',
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
  purchaseOrderId: z.string().optional(),
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
export const PCG_MINIMAL: { code: string; name: string }[] = [
  { code: '401000', name: 'Fournisseurs' },
  { code: '411000', name: 'Clients' },
  { code: '445660', name: 'TVA déductible' },
  { code: '445710', name: 'TVA collectée' },
  { code: '445510', name: 'TVA à décaisser' },
  { code: '445670', name: 'Crédit de TVA à reporter' },
  { code: '512000', name: 'Banque' },
  { code: '530000', name: 'Caisse' },
  { code: '607000', name: 'Achats de marchandises' },
  { code: '627000', name: 'Services bancaires' },
  { code: '707000', name: 'Ventes de marchandises' },
  { code: '706000', name: 'Prestations de services' },
];


/** Totaux HT / TVA / TTC (arrondis au centime, ligne par ligne). */
export function computeInvoiceTotals(
  lines: { quantity: number; unitPriceHt: number; taxRatePct: number }[]
): { totalHt: number; totalTva: number; totalTtc: number } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  let totalHt = 0;
  let totalTva = 0;
  for (const l of lines) {
    const lineHt = r2(l.quantity * l.unitPriceHt);
    totalHt += lineHt;
    totalTva += r2(lineHt * (l.taxRatePct / 100));
  }
  totalHt = r2(totalHt);
  totalTva = r2(totalTva);
  return { totalHt, totalTva, totalTtc: r2(totalHt + totalTva) };
}
