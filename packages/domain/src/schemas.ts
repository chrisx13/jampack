import { z } from 'zod';

export const byId = z.object({ id: z.string().min(1) });
export type ById = z.infer<typeof byId>;

// ── Tiers (Company : client et/ou fournisseur) ──
export const companyCreate = z.object({
  name: z.string().min(1),
  siren: z.string().optional(),
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
});
export type CompanyCreate = z.infer<typeof companyCreate>;

export const companyUpdate = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  siren: z.string().nullable().optional(),
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
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
  primary: '#007D88',
  success: '#00D67F',
  info: '#18DDEF',
  warning: '#FFC400',
  danger: '#FF0000',
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
  taxRateId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});
export type ProductUpdate = z.infer<typeof productUpdate>;

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
  notes: z.string().optional(),
  lines: z.array(invoiceLineInput).default([]),
});
export type InvoiceCreate = z.infer<typeof invoiceCreate>;

export const invoiceUpdate = z.object({
  id: z.string().min(1),
  companyId: z.string().optional(),
  establishmentId: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(invoiceLineInput).optional(),
});
export type InvoiceUpdate = z.infer<typeof invoiceUpdate>;

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
