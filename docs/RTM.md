# RTM — Matrice de traçabilité des exigences

**Projet :** JAMPACK · **Référentiel :** ISO/IEC/IEEE 29148 §5.2.8 · **Statut :** Vivant · **Version :** 1.0

Relie chaque exigence ([SRS](SRS.md)) à sa **conception**, son **code** et sa **preuve de test**.
Légende statut : ✅ livré · 🔧 partiel · ⏳ planifié. « Preuve » = e2e via callers tRPC (RLS actif),
sauf mention. Pour l'état code↔specs détaillé, voir aussi [TRACABILITE.md](TRACABILITE.md).

## Socle & IAM
| Exigence | Conception | Code | Test / Preuve | État |
|---|---|---|---|---|
| FR-IAM-1 | Compte ▸ Société ▸ données | `schema.prisma` (Organization/Societe), `context.ts` | isolation vérifiée par RLS | ✅ |
| FR-IAM-2 | OIDC Keycloak | `auth/oidc.ts`, `keycloak/realm-jampack.json` | boot stack : login SSO OK | ✅ |
| FR-IAM-4/5 | Rôles par société cumulables | `SocieteRole`, `context.ts` | seed 2 users multi-rôles | ✅ |
| FR-IAM-6 | CASL serveur + UI | `domain/ability.ts`, `trpc/trpc.ts` (`authed`) | mutations → FORBIDDEN | ✅ |
| FR-IAM-7/8 | Admin in-app / éditeur de rôles | `iam.router` (lecture), `rights.ts` | — | ⏳ |

## CRM
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-CRM-1..3 | `crm/crm.router.ts` (companies, contacts, establishments) | seed + UI | ✅ |
| FR-CRM-4 | `pages/Pipeline.tsx` (@hello-pangea/dnd) | UI kanban | ✅ |
| FR-CRM-5 | modèle `Activity` | — | 🔧 |

## Référentiels
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-REF-1 | `catalog.router.ts` (products, categories) | seed | ✅ |
| FR-REF-2 | `catalog.router.ts` (taxRates) | seed (5 taux) | ✅ |
| FR-REF-3 | `NumberSequence`, `nextDocumentNumber` | e2e : DE/FA/AV/CM-0001 atomiques | ✅ |

## Ventes
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-VEN-1/2 | `invoice/quote.router.ts`, `salesRouter.ts` | e2e : devis→sent→accepted→converted | ✅ |
| FR-VEN-3 | `invoice/invoice.router.ts`, `invoiceHtml.ts` | e2e : FA-0001 validée ; PDF Chromium | ✅ |
| FR-VEN-4 | `invoice.router.ts` (`createCreditNote`) | e2e : avoir source=facture | ✅ |
| FR-VEN-5 | `billing.router.ts`, `resolveBilling` | subrogation dans le PDF | ✅ |
| FR-VEN-6 | `invoice/payment.router.ts` | e2e : acompte→validée, solde→payée | ✅ |
| FR-VEN-7 | `payment.router.ts` (`echeancier`) | e2e : reste dû, hors échéancier si payé | ✅ |
| FR-VEN-8 | — | — | ⏳ (Factur-X/PDP) |

## Achats
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-ACH-1 | `Company.isSupplier`, `purchases.suppliers` | seed fournisseur | ✅ |
| FR-ACH-2 | `purchases/purchase.router.ts` (`orders`) | e2e : CM-0001 sent | ✅ |
| FR-ACH-3 | `purchase.router.ts` (`receive`) | e2e : réception → stock +200 | ✅ |
| FR-ACH-4 | `purchases/supplierInvoice.router.ts` | e2e : validée→payée, TTC=240 | ✅ |
| FR-ACH-5 | `supplierInvoice.router.ts` (`echeancier`) | e2e : hors échéancier si payée | ✅ |
| FR-ACH-6 | `SupplierInvoice.purchaseOrderId` (lien) | — | ⏳ |

## Stock
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-STK-1 | `stock/stock.router.ts` (`warehouses`) | seed 2 entrepôts | ✅ |
| FR-STK-2 | `stock.router.ts` (`movements`) | e2e : entrée/sortie/ajustement signés | ✅ |
| FR-STK-3 | `stock.router.ts` (`levels`) | e2e : net = +100−30−5 = 65 | ✅ |
| FR-STK-4 | `StockMovement.unitCost` | — | ⏳ (PMP) |

## Transverse & NFR
| Exigence | Code | Preuve | État |
|---|---|---|---|
| FR-TRV-1 | `societe.router.ts` (settings) | UI paramétrage | ✅ |
| FR-TRV-2 | `settings.router.ts`, `applyTheme.ts` | thème par compte | ✅ |
| NFR-FON-1/2 | `computeInvoiceTotals`, `nextDocumentNumber` | e2e totaux + numérotation | ✅ |
| NFR-SEC-1 | `rls.sql`, rôle `jampack_app` | RLS actif au boot (policies vérifiées) | ✅ |
| NFR-SEC-3 | `authed()` | mutations FORBIDDEN sans droit | ✅ |
| NFR-MNT-1 | `packages/domain` (Zod partagé) | typecheck 5 packages verts | ✅ |
| NFR-MNT-3 | `.github/workflows/ci.yml` | migrate→typecheck→build (lint/tests ⏳) | 🔧 |

## Couverture
- Exigences **Must** livrées : socle, CRM, référentiels, ventes (hors e-invoicing), achats, stock.
- Restant **Must** : e-invoicing Factur-X (FR-VEN-8), comptabilité/FEC (FR-CPT-*).
- Chaque feature livrée dispose d'un e2e via les vrais routers tRPC (RLS actif) — voir historique git.
