// Connecteur d'enrichissement IA — NIVEAU 2. Fournisseur UNIQUE : Claude (Anthropic Messages API).
//
// Découplé (appel HTTP direct, sans SDK), activé seulement si ANTHROPIC_API_KEY est présent ET si
// l'organisation a des crédits. Les images (photos/scans) ou le texte difficile sont envoyés à
// Claude qui renvoie les mêmes champs que le moteur local ; la re-validation des identifiants est
// faite par le domaine (fieldsFromRaw) — la validité ne dépend jamais du modèle.
//
// RGPD : c'est le seul chemin où une donnée quitte l'instance. Explicite, mesuré (crédits),
// désactivé par défaut. À encadrer par une clause de sous-traitance (Anthropic).

import type { ExtractionResult } from '@jampack/domain';
import { parseJsonObject, fieldsFromRaw } from '@jampack/domain';

export interface AiExtractInput {
  text?: string | null;
  /** data-URL image (image/jpeg|png…), ex. photo de justificatif compressée côté client. */
  imageDataUrl?: string | null;
}
export interface AiExtractorConfig {
  apiKey: string;
  model: string;
  /** Base URL surchargeable (tests / proxy). Défaut : API Anthropic. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}
/** Usage renvoyé par l'API Anthropic (jetons) — coût fournisseur + observabilité. */
export interface AiUsage { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
export interface AiExtractOutput {
  fields: NonNullable<ExtractionResult['fields']>;
  usage?: AiUsage;
}

const SYSTEM = [
  "Tu extrais les données d'une facture fournisseur ou d'une note de frais française.",
  'Réponds UNIQUEMENT par un objet JSON valide, sans texte ni balise autour, avec ces clés :',
  '{ "supplierName": string|null, "siren": string|null, "siret": string|null, "tvaNumber": string|null,',
  '  "iban": string|null, "invoiceNumber": string|null, "date": "YYYY-MM-DD"|null,',
  '  "totalHt": number|null, "totalTva": number|null, "totalTtc": number|null, "taxRatePct": number|null }.',
  'Montants en euros (nombres, point décimal). Si une donnée est absente ou illisible, mets null.',
  "N'invente jamais une valeur ; en cas de doute, null.",
].join('\n');

function parseImage(dataUrl: string): { media_type: string; data: string } | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  return m ? { media_type: m[1], data: m[2] } : null;
}

/** Appelle Claude pour extraire les champs d'un texte et/ou d'une image. Lève en cas d'échec réseau/API. */
export async function claudeExtract(input: AiExtractInput, cfg: AiExtractorConfig): Promise<AiExtractOutput> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const content: unknown[] = [];
  if (input.imageDataUrl) {
    const img = parseImage(input.imageDataUrl);
    if (img) content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } });
  }
  content.push({ type: 'text', text: input.text?.trim() ? `Document (texte extrait) :\n${input.text.trim().slice(0, 100_000)}` : 'Analyse le document ci-dessus.' });

  const res = await doFetch((cfg.baseUrl ?? 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
    // `cache_control` : prompt caching du system prompt (bénéfice automatique si le prompt dépasse le
    // seuil minimal du modèle ; sans effet sinon — aucun inconvénient).
    body: JSON.stringify({ model: cfg.model, max_tokens: 1024, system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: AiUsage };
  const textOut = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  const raw = parseJsonObject(textOut);
  if (!raw) throw new Error('Réponse IA illisible (JSON introuvable).');
  return { fields: fieldsFromRaw(raw), usage: body.usage };
}

/** Configuration IA active si une clé est présente. Modèle par défaut : Claude Haiku (extraction rapide/économique). */
export function aiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AiExtractorConfig | null {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: env.AI_MODEL || 'claude-haiku-4-5-20251001', baseUrl: env.ANTHROPIC_BASE_URL };
}
