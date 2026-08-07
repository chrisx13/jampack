import { z } from 'zod';
import { router, authed } from '../trpc/trpc';
import { analyzeDocument, toExpenseDraft, toSupplierInvoiceDraft } from '@jampack/domain';

// Reconnaissance de documents — NIVEAU 1 (gratuit, déterministe, local).
// Le client fournit ce qu'il a pu extraire localement, SANS aucun envoi à un tiers :
//  - `facturxXml` : XML CII embarqué dans le PDF (pièce jointe Factur-X) → mapping exact ;
//  - `text`       : couche texte d'un PDF natif (extraite côté client, ex. pdf.js) ;
//  - `ocrText`    : texte d'un OCR local (option).
// Le serveur applique les règles françaises (SIREN/TVA/IBAN validés) et renvoie un résumé + un
// brouillon pré-rempli à FAIRE VALIDER. Aucune pièce n'est créée ici.
//
// Le NIVEAU 2 (enrichissement IA = Claude, mesuré en crédits) est un routeur distinct, désactivé
// par défaut : voir documents.ai.router.ts. Le socle ci-dessous fonctionne sans clé ni budget.

const analyzeInput = z.object({
  text: z.string().max(200_000).optional(),
  facturxXml: z.string().max(2_000_000).optional(),
  ocrText: z.string().max(200_000).optional(),
});

export const documentsRouter = router({
  /** Analyse locale gratuite : Factur-X / texte PDF / OCR → résumé + brouillons + confiance. */
  analyze: authed('read', 'Expense')
    .input(analyzeInput)
    .mutation(({ input }) => {
      const result = analyzeDocument({ text: input.text, facturxXml: input.facturxXml, ocrText: input.ocrText });
      const raw = input.text ?? input.ocrText ?? null;
      return {
        result,
        expenseDraft: toExpenseDraft(result, raw),
        supplierInvoiceDraft: toSupplierInvoiceDraft(result),
      };
    }),
});
