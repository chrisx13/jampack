// Moteur d'extraction de documents — NIVEAU 1 (gratuit, déterministe, local).
//
// Objet : à partir d'un Factur-X (XML CII embarqué) ou du texte d'un PDF/photo, produire un
// **résumé**, un **brouillon pré-rempli** (mapping) et un **indice de confiance par champ**, sans
// aucun appel réseau ni tiers. L'utilisateur **valide** toujours avant création (aucune pièce
// n'est créée/comptabilisée automatiquement).
//
// Niveau 2 (option) : enrichissement par IA (Claude), branché en amont/aval de ce moteur pour les
// cas difficiles (photos/scans). L'IA renvoie la MÊME structure de champs — voir apps/api/.../documents.
//
// Rien ici n'est spécifique à un fournisseur : ce sont des règles françaises (SIREN/TVA/IBAN) et le
// standard EN 16931 (Factur-X). Tout est testé unitairement (déterministe).

import { isValidSiren, isValidSiret, isValidIban, frTvaNumber } from './schemas';

export type Confidence = 'high' | 'medium' | 'low';
export type ExtractSource = 'facturx' | 'pdf-text' | 'ocr' | 'ai' | 'none';
export type DocKind = 'invoice' | 'expense';

export interface ExtractedField<T = string> {
  value: T;
  confidence: Confidence;
  source: ExtractSource;
  /** Pour les identifiants contrôlables (SIREN/SIRET/IBAN/TVA) : résultat de la validation. */
  valid?: boolean;
}

export interface ExtractionResult {
  source: ExtractSource;
  kind: DocKind;
  fields: {
    supplierName?: ExtractedField;
    siren?: ExtractedField;
    siret?: ExtractedField;
    tvaNumber?: ExtractedField;
    iban?: ExtractedField;
    invoiceNumber?: ExtractedField;
    date?: ExtractedField; // ISO yyyy-mm-dd
    totalHt?: ExtractedField<number>;
    totalTva?: ExtractedField<number>;
    totalTtc?: ExtractedField<number>;
    taxRatePct?: ExtractedField<number>;
  };
  /** Résumé lisible (une ligne) présenté à l'utilisateur avant validation. */
  summary: string;
  /** Champs à vérifier (confiance basse, absents ou incohérents). */
  needsReview: string[];
  /** Alertes de cohérence (ex. HT + TVA ≠ TTC). */
  warnings: string[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const digits = (s: string) => s.replace(/[^\d]/g, '');

// ── Normalisation des nombres et dates au format français ──

/** Convertit un montant écrit à la française (« 1 234,56 », « 1.234,56 », « 1234.56 ») en nombre. */
export function parseFrAmount(raw?: string | null): number | null {
  if (!raw) return null;
  let s = String(raw).replace(/[€\s\u00A0]/g, '');
  if (!s) return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // Le dernier séparateur est le décimal ; l'autre marque les milliers.
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    // Plusieurs points, ou un point suivi de 3 chiffres → séparateurs de milliers.
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) s = s.replace(/\./g, '');
  }
  const num = Number(s);
  return Number.isFinite(num) ? r2(num) : null;
}

/** Convertit une date française (JJ/MM/AAAA, JJ-MM-AA, JJ.MM.AAAA) en ISO (AAAA-MM-JJ). */
export function parseFrDate(raw?: string | null): string | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2,4})/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (m[3].length === 2) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(iso + 'T00:00:00Z');
  return Number.isNaN(dt.getTime()) ? null : iso;
}

// ── Extraction depuis un Factur-X (XML CII) : données structurées → confiance haute ──

function tag(xml: string, re: RegExp): string | undefined {
  const m = xml.match(re);
  return m ? m[1].trim() : undefined;
}

/** Extrait les champs d'un XML CrossIndustryInvoice (Factur-X / EN 16931). */
export function extractFromFacturX(xml: string): ExtractionResult {
  const fields: ExtractionResult['fields'] = {};
  const sellerBlock = xml.match(/<ram:SellerTradeParty>([\s\S]*?)<\/ram:SellerTradeParty>/)?.[1] ?? '';
  const settle = xml.match(/<ram:SpecifiedTradeSettlementHeaderMonetarySummation>([\s\S]*?)<\/ram:SpecifiedTradeSettlementHeaderMonetarySummation>/)?.[1] ?? '';

  const name = tag(sellerBlock, /<ram:Name>([^<]*)<\/ram:Name>/);
  if (name) fields.supplierName = { value: name, confidence: 'high', source: 'facturx' };

  const legalId = tag(sellerBlock, /<ram:SpecifiedLegalOrganization>[\s\S]*?<ram:ID[^>]*>([^<]*)<\/ram:ID>/);
  if (legalId) {
    const d = digits(legalId);
    if (d.length === 14) fields.siret = { value: d, confidence: 'high', source: 'facturx', valid: isValidSiret(d) };
    else if (d.length === 9) fields.siren = { value: d, confidence: 'high', source: 'facturx', valid: isValidSiren(d) };
  }
  const vat = tag(sellerBlock, /<ram:SpecifiedTaxRegistration>[\s\S]*?schemeID="VA"[^>]*>([^<]*)<\/ram:ID>/);
  if (vat) fields.tvaNumber = { value: vat.replace(/\s/g, ''), confidence: 'high', source: 'facturx' };

  const num = xml.match(/<rsm:ExchangedDocument>[\s\S]*?<ram:ID>([^<]*)<\/ram:ID>/)?.[1]?.trim();
  if (num) fields.invoiceNumber = { value: num, confidence: 'high', source: 'facturx' };

  const date8 = xml.match(/<ram:IssueDateTime>[\s\S]*?format="102">(\d{8})</)?.[1];
  if (date8) {
    const iso = `${date8.slice(0, 4)}-${date8.slice(4, 6)}-${date8.slice(6, 8)}`;
    fields.date = { value: iso, confidence: 'high', source: 'facturx' };
  }

  const ht = parseFrAmount(tag(settle, /<ram:LineTotalAmount>([^<]*)</) ?? null);
  const tva = parseFrAmount(tag(settle, /<ram:TaxTotalAmount[^>]*>([^<]*)</) ?? null);
  const ttc = parseFrAmount(tag(settle, /<ram:GrandTotalAmount>([^<]*)</) ?? null);
  if (ht != null) fields.totalHt = { value: ht, confidence: 'high', source: 'facturx' };
  if (tva != null) fields.totalTva = { value: tva, confidence: 'high', source: 'facturx' };
  if (ttc != null) fields.totalTtc = { value: ttc, confidence: 'high', source: 'facturx' };
  if (ht && tva != null && ht > 0) fields.taxRatePct = { value: r2((tva / ht) * 100), confidence: 'high', source: 'facturx' };

  return finalize('facturx', fields);
}

// ── Extraction depuis du texte libre (PDF natif ou OCR) : règles FR ──

/** Cherche un montant étiqueté (ex. « Total TTC : 120,00 € ») ; renvoie le nombre ou null. */
function labelledAmount(text: string, labels: RegExp): number | null {
  const re = new RegExp(labels.source + String.raw`[^\d\-]{0,24}?(\d[\d .\u00A0]*(?:,\d{1,2})?)`, 'i');
  const m = text.match(re);
  return m ? parseFrAmount(m[1]) : null;
}

/** Extrait les champs d'un texte brut (PDF natif ou OCR) par règles françaises. */
export function extractFromText(text: string, source: ExtractSource = 'pdf-text'): ExtractionResult {
  const fields: ExtractionResult['fields'] = {};
  const t = text.replace(/\u00A0/g, ' ');

  // SIRET (14) puis SIREN (9), étiquetés en priorité, validés par clé de Luhn.
  const siretM = t.match(/siret\D{0,12}((?:\d[ .]?){14})/i) ?? t.match(/\b(\d{3}[ .]?\d{3}[ .]?\d{3}[ .]?\d{5})\b/);
  if (siretM) {
    const d = digits(siretM[1]);
    if (d.length === 14) {
      const valid = isValidSiret(d);
      fields.siret = { value: d, confidence: valid ? 'high' : 'low', source, valid };
      fields.siren = { value: d.slice(0, 9), confidence: valid ? 'high' : 'low', source, valid: isValidSiren(d.slice(0, 9)) };
    }
  }
  if (!fields.siren) {
    const sirenM = t.match(/siren\D{0,12}((?:\d[ .]?){9})/i) ?? t.match(/\b(\d{3}[ .]?\d{3}[ .]?\d{3})\b/);
    if (sirenM) {
      const d = digits(sirenM[1]);
      if (d.length === 9) {
        const valid = isValidSiren(d);
        fields.siren = { value: d, confidence: valid ? 'high' : 'low', source, valid };
      }
    }
  }

  // N° TVA intracommunautaire FR : cohérence via la clé DGFiP (frTvaNumber du SIREN).
  const tvaM = t.match(/\bFR[ ]?([0-9A-Z]{2})[ ]?((?:\d[ ]?){9})/i);
  if (tvaM) {
    const normalized = ('FR' + tvaM[1] + digits(tvaM[2])).toUpperCase().replace(/\s/g, '');
    const sirenPart = normalized.slice(4);
    const valid = frTvaNumber(sirenPart) === normalized;
    fields.tvaNumber = { value: normalized, confidence: valid ? 'high' : 'medium', source, valid };
    if (!fields.siren && isValidSiren(sirenPart)) fields.siren = { value: sirenPart, confidence: 'high', source, valid: true };
  }

  // IBAN : validé mod-97. On exige une longueur d'IBAN réelle (≥ 15 caractères) pour ne pas
  // confondre avec un n° de TVA intracommunautaire (FR + 11 chiffres = 13 caractères).
  const ibanM = t.match(/\b([A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30})\b/i);
  if (ibanM) {
    const raw = ibanM[1].replace(/\s/g, '');
    if (raw.length >= 15 && raw.length <= 34) {
      const valid = isValidIban(raw);
      fields.iban = { value: raw, confidence: valid ? 'high' : 'low', source, valid };
    }
  }

  // N° de facture.
  const numM = t.match(/\b(?:facture|invoice|n[°o]\s*(?:de\s*)?facture)\s*(?:n[°o]|num[ée]ro|#)?\s*[-:]?\s*([A-Za-z0-9][A-Za-z0-9/-]{2,24})/i);
  if (numM && !/^facture$/i.test(numM[1])) fields.invoiceNumber = { value: numM[1], confidence: 'medium', source };

  // Date (première date plausible ; si étiquetée « date », confiance plus haute).
  const dateLab = t.match(/date[^\d]{0,12}(\d{1,2}[/.\- ]\d{1,2}[/.\- ]\d{2,4})/i);
  const dateAny = t.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/);
  const isoDate = parseFrDate(dateLab?.[1] ?? dateAny?.[1]);
  if (isoDate) fields.date = { value: isoDate, confidence: dateLab ? 'high' : 'medium', source };

  // Montants étiquetés.
  const ttc = labelledAmount(t, /(?:total\s*ttc|net\s*[àa]\s*payer|montant\s*ttc|total\s*t\.?t\.?c\.?)/);
  const ht = labelledAmount(t, /(?:total\s*ht|montant\s*ht|base\s*ht|total\s*h\.?t\.?)/);
  // Montant de TVA : « TVA », un taux éventuel (« 20 % »), puis le montant. On exige des centimes
  // (`,dd`) pour ne pas confondre le montant avec le taux (« 20 % »).
  const tvaAmtM = t.match(/t\.?v\.?a\.?(?:\s*\d{1,2}(?:[.,]\d)?\s*%)?\s*[:=]?\s*(\d[\d . ]*,\d{2})\s*€?/i);
  const tva = tvaAmtM ? parseFrAmount(tvaAmtM[1]) : null;
  const rateM = t.match(/tva\D{0,8}(\d{1,2}(?:[.,]\d)?)\s*%/i) ?? t.match(/\b(20|10|5[.,]5|2[.,]1)\s*%/);
  if (ht != null) fields.totalHt = { value: ht, confidence: 'high', source };
  if (tva != null) fields.totalTva = { value: tva, confidence: 'high', source };
  if (ttc != null) fields.totalTtc = { value: ttc, confidence: 'high', source };
  if (rateM) fields.taxRatePct = { value: parseFrAmount(rateM[1]) ?? 20, confidence: 'medium', source };

  // Nom du fournisseur : 1re ligne « propre » (heuristique → confiance basse).
  const firstLine = t.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length >= 3 && l.length <= 60 && !/^\d/.test(l) && !/facture|siret|siren|tva|iban|total|date/i.test(l));
  if (firstLine) fields.supplierName = { value: firstLine, confidence: 'low', source };

  return finalize(source, fields);
}

// ── Finalisation : résumé, cohérence, champs à vérifier ──

function finalize(source: ExtractSource, fields: ExtractionResult['fields']): ExtractionResult {
  const warnings: string[] = [];
  const ht = fields.totalHt?.value;
  const tva = fields.totalTva?.value;
  const ttc = fields.totalTtc?.value;
  // Déductions : compléter un total manquant à partir des deux autres.
  if (ht != null && tva != null && ttc == null) fields.totalTtc = { value: r2(ht + tva), confidence: 'medium', source };
  if (ht != null && ttc != null && tva == null) fields.totalTva = { value: r2(ttc - ht), confidence: 'medium', source };
  if (ttc != null && tva != null && ht == null) fields.totalHt = { value: r2(ttc - tva), confidence: 'medium', source };
  if (ht != null && tva != null && ttc != null && Math.abs(r2(ht + tva) - ttc) > 0.02) {
    warnings.push(`Incohérence des totaux : HT ${eur(ht)} + TVA ${eur(tva)} ≠ TTC ${eur(ttc)}.`);
  }

  const needsReview: string[] = [];
  for (const [k, f] of Object.entries(fields)) {
    if (f && (f.confidence === 'low' || f.valid === false)) needsReview.push(k);
  }
  for (const k of ['supplierName', 'date', 'totalTtc'] as const) {
    if (!fields[k]) needsReview.push(k);
  }

  return { source, kind: 'invoice', fields, summary: buildSummary(fields), needsReview: [...new Set(needsReview)], warnings };
}

const eur = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const frDate = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : undefined);

function buildSummary(f: ExtractionResult['fields']): string {
  const parts: string[] = [];
  if (f.supplierName) parts.push(f.supplierName.value);
  if (f.invoiceNumber) parts.push(`Facture n° ${f.invoiceNumber.value}`);
  if (f.date) parts.push(`du ${frDate(f.date.value)}`);
  if (f.totalHt) parts.push(`HT ${eur(f.totalHt.value)}`);
  if (f.totalTva) parts.push(`TVA ${eur(f.totalTva.value)}`);
  if (f.totalTtc) parts.push(`TTC ${eur(f.totalTtc.value)}`);
  return parts.length ? parts.join(' · ') : 'Aucune donnée reconnue automatiquement.';
}

// ── Cascade : Factur-X prioritaire, sinon texte ; fusion avec un apport IA optionnel ──

export interface AnalyzeInput {
  facturxXml?: string | null;
  text?: string | null;
  ocrText?: string | null;
  /** Champs déjà extraits par l'IA (niveau 2) — fusionnés sans écraser une source structurée. */
  aiFields?: ExtractionResult['fields'] | null;
}

/** Fusionne `add` dans `base` sans écraser un champ de confiance ≥ à celle de l'apport. */
const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
function merge(base: ExtractionResult['fields'], add: ExtractionResult['fields']): void {
  for (const [k, f] of Object.entries(add) as [keyof ExtractionResult['fields'], ExtractedField][]) {
    if (!f) continue;
    const cur = base[k] as ExtractedField | undefined;
    if (!cur || RANK[f.confidence] > RANK[cur.confidence]) (base as Record<string, ExtractedField>)[k] = f;
  }
}

/** Analyse en cascade : (a) Factur-X, (b) texte PDF natif, (c) OCR, (d) apport IA. */
export function analyzeDocument(input: AnalyzeInput): ExtractionResult {
  let primary: ExtractSource = 'none';
  const fields: ExtractionResult['fields'] = {};
  if (input.facturxXml && /CrossIndustryInvoice/.test(input.facturxXml)) {
    merge(fields, extractFromFacturX(input.facturxXml).fields);
    primary = 'facturx';
  }
  if (input.text && input.text.trim()) {
    merge(fields, extractFromText(input.text, 'pdf-text').fields);
    if (primary === 'none') primary = 'pdf-text';
  }
  if (input.ocrText && input.ocrText.trim()) {
    merge(fields, extractFromText(input.ocrText, 'ocr').fields);
    if (primary === 'none') primary = 'ocr';
  }
  if (input.aiFields) {
    merge(fields, input.aiFields);
    if (primary === 'none') primary = 'ai';
  }
  return finalize(primary, fields);
}

// ── Mapping vers un brouillon (validation humaine ensuite) ──

export interface ExpenseDraft {
  date?: string;
  category: string;
  description: string;
  amountHt?: number;
  taxRatePct: number;
}

/** Devine une catégorie de frais à partir du texte (mots-clés) ; défaut « autre ». */
export function guessExpenseCategory(text?: string | null): string {
  const t = (text ?? '').toLowerCase();
  if (/(h[ôo]tel|nuit[ée]e|h[ée]bergement|airbnb|booking)/.test(t)) return 'hebergement';
  if (/(restaurant|repas|brasserie|caf[ée]|d[ée]jeuner|d[îi]ner|traiteur)/.test(t)) return 'repas';
  if (/(p[ée]age|parking|stationnement|autoroute)/.test(t)) return 'peage';
  if (/(train|sncf|taxi|uber|vol|a[ée]rien|essence|carburant|p[ée]ripherique|billet|transport)/.test(t)) return 'deplacement';
  if (/(fourniture|papeterie|mat[ée]riel|bureau)/.test(t)) return 'fournitures';
  return 'autre';
}

/** Construit un brouillon de note de frais à partir de l'extraction (à faire valider). */
export function toExpenseDraft(res: ExtractionResult, rawText?: string | null): ExpenseDraft {
  const f = res.fields;
  const rate = f.taxRatePct?.value ?? 20;
  const ht = f.totalHt?.value ?? (f.totalTtc ? r2(f.totalTtc.value / (1 + rate / 100)) : undefined);
  const descParts = [f.supplierName?.value, f.invoiceNumber ? `n° ${f.invoiceNumber.value}` : undefined].filter(Boolean);
  return {
    date: f.date?.value,
    category: guessExpenseCategory(rawText ?? f.supplierName?.value),
    description: (descParts.join(' ') || 'Dépense à qualifier').slice(0, 200),
    amountHt: ht,
    taxRatePct: rate,
  };
}

export interface SupplierInvoiceDraft {
  supplierName?: string;
  siren?: string;
  tvaNumber?: string;
  iban?: string;
  invoiceNumber?: string;
  date?: string;
  totalHt?: number;
  totalTva?: number;
  totalTtc?: number;
}

/** Construit un brouillon de facture fournisseur à partir de l'extraction (à faire valider). */
export function toSupplierInvoiceDraft(res: ExtractionResult): SupplierInvoiceDraft {
  const f = res.fields;
  return {
    supplierName: f.supplierName?.value,
    siren: f.siren?.value,
    tvaNumber: f.tvaNumber?.value,
    iban: f.iban?.value,
    invoiceNumber: f.invoiceNumber?.value,
    date: f.date?.value,
    totalHt: f.totalHt?.value,
    totalTva: f.totalTva?.value,
    totalTtc: f.totalTtc?.value,
  };
}
