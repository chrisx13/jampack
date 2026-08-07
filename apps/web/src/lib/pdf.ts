// Extraction locale (navigateur) du contenu d'un PDF — GRATUITE, sans réseau.
//  - couche texte (PDF natif) → règles FR côté serveur ;
//  - pièce jointe Factur-X (XML CII embarqué) → mapping exact.
// Le worker pdf.js est bundlé par Vite (aucun CDN).

import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfExtract {
  text: string;
  facturxXml?: string;
}

/** Lit un PDF côté client : renvoie le texte concaténé et, si présent, le XML Factur-X embarqué. */
export async function extractPdf(file: File): Promise<PdfExtract> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text += content.items.map((it: any) => (typeof it?.str === 'string' ? it.str : '')).join(' ') + '\n';
  }

  let facturxXml: string | undefined;
  try {
    // pdf.js peut renvoyer une Map (v6) ou un objet selon la version : on traite les deux.
    const raw = (await pdf.getAttachments()) as unknown;
    type Att = { filename?: string; content?: Uint8Array };
    const entries: [string, Att][] = raw instanceof Map
      ? [...(raw as Map<string, Att>).entries()]
      : Object.entries((raw as Record<string, Att>) ?? {});
    for (const [key, a] of entries) {
      const name = (a.filename || key || '').toLowerCase();
      if (a.content && (name.endsWith('.xml') || /factur|zugferd|cii|xrechnung/.test(name))) {
        const xml = new TextDecoder('utf-8').decode(a.content);
        if (xml.includes('CrossIndustryInvoice')) { facturxXml = xml; break; }
      }
    }
  } catch { /* pas de pièce jointe exploitable */ }

  return { text, facturxXml };
}

/** Réduit une image (canvas) et renvoie une data-URL JPEG compressée — pour l'envoi IA / justificatif. */
export async function imageToDataUrl(file: File, maxSize = 1600, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}
