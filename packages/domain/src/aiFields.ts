// Transformation PURE de la sortie brute d'un modèle IA (Claude) en champs typés du moteur
// d'extraction, avec RE-VALIDATION locale des identifiants (SIREN/SIRET/IBAN/TVA). La validité ne
// dépend jamais du modèle : nos propres contrôles la déterminent. Testé unitairement (déterministe).
//
// L'appel HTTP à Claude vit dans apps/api (aiExtractor.ts) ; seul le mapping/validation est ici.

import type { ExtractionResult } from './docExtract';
import { isValidSiren, isValidSiret, isValidIban, frTvaNumber } from './schemas';

export type AiRawFields = Record<string, string | number | null | undefined>;

/** Extrait le premier objet JSON d'une réponse texte (robuste à un éventuel texte parasite). */
export function parseJsonObject(text: string): AiRawFields | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as AiRawFields;
  } catch {
    return null;
  }
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
};

/** Convertit la sortie brute du modèle en champs typés (source « ai »), identifiants re-validés localement. */
export function fieldsFromRaw(raw: AiRawFields): NonNullable<ExtractionResult['fields']> {
  const f: NonNullable<ExtractionResult['fields']> = {};
  const name = str(raw.supplierName);
  if (name) f.supplierName = { value: name, confidence: 'medium', source: 'ai' };

  const siret = str(raw.siret)?.replace(/\D/g, '');
  if (siret && siret.length === 14) { const valid = isValidSiret(siret); f.siret = { value: siret, confidence: valid ? 'high' : 'low', source: 'ai', valid }; }
  const siren = str(raw.siren)?.replace(/\D/g, '') ?? (siret && siret.length === 14 ? siret.slice(0, 9) : undefined);
  if (siren && siren.length === 9) { const valid = isValidSiren(siren); f.siren = { value: siren, confidence: valid ? 'high' : 'low', source: 'ai', valid }; }

  const tva = str(raw.tvaNumber)?.toUpperCase().replace(/\s/g, '');
  if (tva) { const valid = frTvaNumber(tva.slice(4)) === tva; f.tvaNumber = { value: tva, confidence: valid ? 'high' : 'medium', source: 'ai', valid }; }

  const iban = str(raw.iban)?.toUpperCase().replace(/\s/g, '');
  if (iban) { const valid = isValidIban(iban); f.iban = { value: iban, confidence: valid ? 'high' : 'low', source: 'ai', valid }; }

  const invNum = str(raw.invoiceNumber);
  if (invNum) f.invoiceNumber = { value: invNum, confidence: 'medium', source: 'ai' };

  const date = str(raw.date);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) f.date = { value: date, confidence: 'medium', source: 'ai' };

  const ht = num(raw.totalHt), tva2 = num(raw.totalTva), ttc = num(raw.totalTtc), rate = num(raw.taxRatePct);
  if (ht != null) f.totalHt = { value: ht, confidence: 'medium', source: 'ai' };
  if (tva2 != null) f.totalTva = { value: tva2, confidence: 'medium', source: 'ai' };
  if (ttc != null) f.totalTtc = { value: ttc, confidence: 'medium', source: 'ai' };
  if (rate != null) f.taxRatePct = { value: rate, confidence: 'medium', source: 'ai' };
  return f;
}
