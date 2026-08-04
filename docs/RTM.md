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
| FR-IAM-7 | `iam.router` (`invite`/`grantRole`/`revokeRole`), `Members.tsx` | e2e int : invite→grant→revoke ; garde-fou dernier admin | ✅ |
| FR-IAM-7b | `societe.router` (`create`/`listAll`), `Societes.tsx` | e2e int : société créée + accessible au créateur | ✅ |
| FR-IAM-8 | Éditeur de droits fin `rights.ts` | — | ⏳ |

## CRM
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-CRM-1..3 | `crm/crm.router.ts` (companies, contacts, establishments) | seed + UI | ✅ |
| FR-CRM-4 | `pages/Pipeline.tsx` (@hello-pangea/dnd) | UI kanban | ✅ |
| FR-CRM-5 | `crm.router.ts` (`activities.{list,tasks,create,complete,reopen,remove}`), modèle `Activity` (+`companyId`/`done`/`doneAt`), `activityCreate`/`activityTypeLabel`/`isActivityOverdue`, `Activities.tsx` | unit : rattachement requis, libellés, retard ; e2e int : tâche créée→listée→clôturée, activité orpheline rejetée | ✅ |
| FR-CRM-6 | `crm.opportunities.pipelineSummary` (synthèse pondérée + **taux de conversion** gagné/clôturé), `PipelineStage.probability`, synthèse + probabilités + win rate dans `Pipeline.tsx` | e2e int : pondéré = Σ montant × proba/100, ≤ total ; winRate cohérent avec gagné/perdu | ✅ |

## Référentiels
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-REF-1 | `catalog.router.ts` (products, categories) | seed | ✅ |
| FR-REF-2 | `catalog.router.ts` (taxRates) | seed (5 taux) | ✅ |
| FR-REF-3 | `NumberSequence`, `nextDocumentNumber` | e2e : DE/FA/AV/CM-0001 atomiques | ✅ |
| FR-REF-5 | `resolvePrice` (domain), `PriceRule` (+ RLS org/société), `catalog.priceRules` (`list`/`create`/`remove`), résolution dans `SalesDocs.tsx` (onPickProduct + qté), gestion `Catalogue.tsx` | unit : priorité client/palier/base ; e2e int : règles créées/listées/supprimées | ✅ |
| FR-REF-4 | `catalog.products.importCsv`, `parseProductsCsv`, bouton import `Catalogue.tsx` | unit : parse réf/nom/prix/unité/type + en-tête ignoré + prix invalide ; e2e int : import crée puis met à jour par référence (pas de doublon) | ✅ |

## Ventes
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-VEN-1/2 | `invoice/quote.router.ts`, `salesRouter.ts` | e2e : devis→sent→accepted→converted | ✅ |
| FR-VEN-3 | `invoice/invoice.router.ts`, `invoiceHtml.ts` | e2e : FA-0001 validée ; PDF Chromium | ✅ |
| FR-VEN-4 | `invoice.router.ts` (`createCreditNote`), `fullInclude.source`, réf. structurée sur le PDF `invoiceHtml.ts` | e2e : avoir source=facture ; `get` expose `source.number` (« Se rapporte à la facture … ») | ✅ |
| FR-VEN-5 | `billing.router.ts`, `resolveBilling` | subrogation dans le PDF | ✅ |
| FR-VEN-6 | `invoice/payment.router.ts` | e2e : acompte→validée, solde→payée | ✅ |
| FR-VEN-7 | `payment.router.ts` (`echeancier`) | e2e : reste dû, hors échéancier si payé | ✅ |
| FR-VEN-9 | `payment.router.ts` (`reminders`/`recordReminder`/`reminderLetter`), `dunningMessage`, `Invoice.reminderLevel`, `Reminders.tsx` | unit : libellés + message ; e2e int : échue → relance niveau 1, lettre niveau 2 | ✅ |
| FR-VEN-10 | `quote.router.ts` (`expiring`), `isQuoteExpired`/`quoteDaysToExpiry`, `Invoice.validUntil`, `QuotesExpiring.tsx` | unit : expiré/valide/non applicable + jours restants ; e2e int : devis émis à validité dépassée = expiré, TTC calculé | ✅ |
| FR-VEN-11 | `discountMention`/`DISCOUNT_MENTION_NONE`, `Societe.discountTerms`, mention dans `invoiceHtml.ts`, champ `SocieteSettings.tsx` | unit : sans condition → « néant », avec condition → détaillée ; e2e int : discountTerms paramétré persiste | ✅ |
| FR-VEN-12 | `makeSalesRouter.duplicate` (+ `copyLines`), bouton Dupliquer `SalesDocs.tsx` | e2e int : facture dupliquée = brouillon sans numéro, mêmes lignes/client + réf. commande | ✅ |
| FR-VEN-13 | `invoiceHtml.ts` (bloc `docType === 'devis'` : validité + CGV + « Bon pour accord ») | rendu PDF (gabarit) | ✅ |
| FR-VEN-14 | `Invoice.customerReference`, `invoiceCreate`/`invoiceUpdate`, champ `SalesDocs.tsx`, affichage `invoiceHtml.ts` + Factur-X `facturx.ts` (BT-13 `BuyerOrderReferencedDocument`) | e2e int : référence persistée, copiée à la duplication, présente dans le XML CII | ✅ |
| FR-VEN-15 | `computeInvoiceTotals(lines, opts)` + `effectiveDiscountFactor`, `Invoice.discountType`/`discountValue`, helper unique `salesTotals(inv)` propagé (liste, PDF, `payment.router`, `accounting.postSalesInvoice`, `analytics`, `facturx`), contrôle `SalesDocs.tsx` | unit : remise %/montant, TVA par taux préservée, none/0 ignoré ; e2e int : remise 10 % → totaux nets, reste dû, solde, comptabilisation | ✅ |
| FR-VEN-16 | `depositLines` (domain), `quote.createDepositInvoice` + déduction dans `convertToInvoice` (facteur de remise), `Invoice.isDeposit`, bouton « Facture d'acompte » `SalesDocs.tsx` | unit : acompte 30 % ventilé par taux, base nette ; e2e int : acompte 30 % multi-taux (360 HT / 423,30 TTC) puis solde = total − acompte | ✅ |
| FR-VEN-17 | `nextOccurrence`/`recurrenceLabel`/`recurringCreate` (domain), `RecurringInvoice` (+ RLS org/société), `recurring.router` (`list`/`create`/`update`/`remove`/`generateDue`), `RecurringInvoices.tsx` | unit : nextOccurrence par fréquence/intervalle ; e2e int : échéance dépassée → facture brouillon générée + échéance avancée | ✅ |
| FR-VEN-18 | `Invoice.deliveryNumber`/`deliveredAt`, séquence « bl » (BL-), `invoice.router` (`issueDelivery`/`deliveryNote`), `deliveryHtml.ts`, bouton `SalesDocs.tsx` | e2e int : n° BL séquentiel + date attribués, idempotents ; gabarit PDF sans prix | ✅ |
| FR-VEN-8 | `invoice/facturx.ts`, `invoice/pdp.ts`, `invoice.router.ts` (`facturx`/`sendToPdp`/`transmissions`), `PdpTransmission` | `sales.int.test.ts` › *E-invoicing — Factur-X & PDP interne* | 🔧 (génération CII + connecteur ✅ ; immatriculation DGFiP/PPF/e-reporting ⛔ hors périmètre logiciel) |

## Achats
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-ACH-1 | `Company.isSupplier`, `purchases.suppliers` | seed fournisseur | ✅ |
| FR-ACH-2 | `purchases/purchase.router.ts` (`orders`) | e2e : CM-0001 sent | ✅ |
| FR-ACH-3 | `purchase.router.ts` (`receive`) | e2e : réception → stock +200 | ✅ |
| FR-ACH-4 | `purchases/supplierInvoice.router.ts` | e2e : validée→payée, TTC=240 | ✅ |
| FR-ACH-5 | `supplierInvoice.router.ts` (`echeancier`, reste dû) | e2e : reste dû, hors échéancier si soldée | ✅ |
| FR-ACH-6 | `supplierPayment.router.ts`, `accounting.postSupplierPayment`, `SupplierPayment` | e2e : partiel→reste dû, solde→payée, écriture 401=512, suppression→validée | ✅ |
| FR-ACH-7 | `supplierInvoices.match`, `SupplierInvoice.purchaseOrderId`, panneau rapprochement (`SupplierInvoices.tsx`) | e2e int : facture conforme = OK ; facture surévaluée = écart détecté | ✅ |
| FR-ACH-8 | `purchases.orders.overdue`, `isPurchaseOrderOverdue`/`purchaseOrderDaysLate`, `OverduePurchaseOrders.tsx` | unit : retard si envoyée+date dépassée, jours de retard ; e2e int : commande J−10 listée, sort après réception | ✅ |
| FR-ACH-9 | `purchases.orders.receivePartial`, `purchaseReceipt`, `PurchaseOrderLine.quantityReceived`, panneau réception `PurchaseOrders.tsx` | unit : quantités par ligne, liste vide/négative rejetée ; e2e int : 60/100 → partial, dépassement refusé, 40 → received, stock cumulé 100 | ✅ |
| FR-ACH-10 | `purchases.orders.duplicate`, bouton Dupliquer `PurchaseOrders.tsx` | e2e int : commande dupliquée = brouillon sans numéro, mêmes lignes/fournisseur | ✅ |
| FR-ACH-11 | `Expense` (+ RLS org/société), `expenses.router` (`list`/`create`/`update`/`validate`/`post`/`markReimbursed`), `EXPENSE_CATEGORIES`/`expenseCategoryAccount`, `Expenses.tsx` | e2e int : création → validation → comptabilisation équilibrée (6xx+44566=421), idempotente | ✅ |

## Stock
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-STK-1 | `stock/stock.router.ts` (`warehouses`) | seed 2 entrepôts | ✅ |
| FR-STK-2 | `stock.router.ts` (`movements`) | e2e : entrée/sortie/ajustement signés | ✅ |
| FR-STK-3 | `stock.router.ts` (`levels`) | e2e : net = +100−30−5 = 65 | ✅ |
| FR-STK-4 | `stock.router.ts` (`valuation`), `StockMovement.unitCost` | e2e : PMP démo = 390 (225+165) | ✅ |
| FR-STK-5 | `stock.router.ts` (`inventory`, `lowStock`), `Product.reorderPoint`, `StockLevels.tsx` | e2e int : inventaire aligne le niveau (Δ) + idempotent ; article sous seuil listé, disparaît au-dessus | ✅ |
| FR-STK-6 | `stock.lots`, `StockMovement.lotNumber`/`expiryDate`, `StockLots.tsx` | e2e int : solde net par lot + statut périmé | ✅ |
| FR-STK-7 | `stock.valuation({method:'fifo'})`, `StockValuation.tsx` (bascule PMP/FIFO) | e2e int : 100@2+100@4, sortie 150 → FIFO 200 vs PMP 150 | ✅ |
| FR-STK-8 | `stock.movements.transfer`, `stockTransfer` (refine source≠destination, qté>0), carte transfert `StockMovements.tsx` | unit : transfert valide / source=dest rejeté / qté ≤ 0 rejetée ; e2e int : −30 source, +30 destination, source=dest rejeté | ✅ |
| FR-STK-9 | `stock.exportLevels`, `stockLevelsCsv` (échappement `;`/`"`, décimale FR), bouton export `StockLevels.tsx` | unit : en-tête + échappement + liste vide ; e2e int : export contient l'article stocké | ✅ |

## Comptabilité
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-CPT-1 | `accounting.router.ts` (`accounts`, `journals`, `initPcg`) | seed : 10 comptes + 4 journaux/société | ✅ |
| FR-CPT-2 | `accounting.entries.create` + refine Zod `journalEntryCreate` | e2e : écriture équilibrée OK, déséquilibrée **rejetée** | ✅ |
| FR-CPT-3 | `accounting.balance` (groupBy) | e2e : 411 débit 120, D=C | ✅ |
| FR-CPT-3b | `accounting.ledger`/`exportLedger`, `ledgerCsv`, `Ledger.tsx` (bouton CSV) | e2e int : grand livre 411 → solde progressif = D−C ; unit : CSV en-tête/date FR/décimale/échappement | ✅ |
| FR-CPT-4 | `accounting.postSalesInvoice`, `Invoice.journalEntryId` | e2e : facture→écriture 411/707/44571 équilibrée, idempotent | ✅ |
| FR-CPT-4b | `accounting.postPayment` (BQ), `accounting.postSupplierInvoice` (AC), `accounting.postSupplierPayment` (BQ) | e2e int : 512↔411 ; 607+44566↔401 ; 401↔512 équilibrées, idempotentes | ✅ |
| FR-CPT-5 | `accounting.vatReturn` (44571 − 44566) | e2e int : Δ collectée +20 / déductible +40 | ✅ |
| FR-CPT-5b | `accounting.accountLines`/`letter`/`unletter`, `Lettrage.tsx` | e2e int : lettrage équilibré, rejet déséquilibre, délettrage | ✅ |
| FR-CPT-5c | `accounting.closeVat` (journal OD) | e2e int : clôture → 44571/44566 soldés à 0 | ✅ |
| FR-CPT-5d | `accounting.bankLines`/`reconcile`, `JournalEntryLine.reconciled`, `BankReconciliation.tsx` | e2e int : pointage d'une ligne 512 → solde pointé +120 | ✅ |
| FR-CPT-6 | `accounting.fec` (18 colonnes normées, tabulé) | e2e int : entête FEC + lignes 411000, filename .txt | ✅ |
| FR-CPT-7 | `accounting.fixedAssets` (+ `schedule`/`postDepreciation`), `depreciationSchedule`, `FixedAsset`, `FixedAssets.tsx` | unit : 1200/3 ans → [400,400,400] et prorata [200,400,400,200] ; e2e int : 3000/3 ans → 1000/an, dotation 681/281 équilibrée & idempotente | ✅ |
| FR-CPT-8 | `accounting.incomeStatement`/`balanceSheet` (classes PCG), `FinancialStatements.tsx` | e2e int : vente comptabilisée → produit 707 au CR ; bilan équilibré (actif=passif+résultat), résultat CR=bilan | ✅ |
| FR-CPT-9 | `accounting.exportBalance`, `balanceCsv`, bouton export CSV `TrialBalance.tsx` | unit : en-tête + montants FR + liste vide ; e2e int : export contient 411000 après vente comptabilisée | ✅ |

## Trésorerie
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| FR-TRE-1 | `analytics.tresorerie`, `Tresorerie.tsx` | e2e int : reste dû clients (encaissements) + fournisseurs (décaissements), position nette | ✅ |
| FR-TRE-4 | `analytics.cashflowForecast` (buckets hebdo lundi, retards → S0), courbe dans `Tresorerie.tsx` | e2e int : échéance à ~2 sem. imputée, cumul S8 = totalIn−totalOut | ✅ |
| FR-TRE-2 | rapprochement bancaire (voir FR-CPT-5d) | e2e int | ✅ |
| FR-TRE-3 | `analytics.agedReceivables`, `AgedReceivables.tsx` | e2e int : facture à 45 j → tranche 31-60 | ✅ |

## Conformité — identifiants légaux
| Exigence | Code | Test / Preuve | État |
|---|---|---|---|
| Contrôle SIREN/SIRET (Luhn) + calcul TVA intra | `isValidSiren`/`isValidSiret`/`frTvaNumber` (domain), auto-remplissage + `isInvalid` dans `Clients.tsx` & `SocieteSettings.tsx` | unit : Luhn OK/KO, longueurs, espaces tolérés ; `frTvaNumber('732829320')='FR44732829320'`, invalide→null | ✅ |
| Validation IBAN (mod-97) / BIC + formatage | `isValidIban`/`isValidBic`/`formatIban` (domain), `BillingSettings.tsx` (comptes+affactureurs), RIB `invoiceHtml.ts` | unit : IBAN FR canonique OK, clé erronée KO, espaces tolérés ; BIC 8/11 ; formatage par groupes de 4 | ✅ |

## Transverse & NFR
| Exigence | Code | Preuve | État |
|---|---|---|---|
| FR-TRV-1 | `societe.router.ts` (settings) | UI paramétrage | ✅ |
| FR-TRV-2 | `settings.router.ts`, `applyTheme.ts` | thème par compte | ✅ |
| FR-TRV-5 | `analytics.router.ts` (`summary`), `Dashboard.tsx` | e2e int : CA facturé Δ +120 | ✅ |
| FR-TRV-6 | `analytics.agenda`/`agendaIcs` (tâches CRM + échéances clients/fournisseurs + livraisons), `buildAgendaIcs` (RFC 5545), `Agenda.tsx` (domaine Gestion, export ICS) | unit : VCALENDAR/VEVENT + échappement ; e2e int : facture échue en retard + ICS contient l'événement | ✅ |
| FR-TRV-4 | middleware `auditMiddleware` (`trpc.ts`), `AuditLog`, `audit.router.ts` (`list`/`exportCsv`), `auditLogCsv`, `AuditLog.tsx` | unit : CSV en-tête/date FR/échappement ; e2e int : mutation → entrée (action, user, réf) + export CSV contient l'action | ✅ |
| FR-TRV-7 | `notes.router.ts` (`list`/`create`/`edit`/`move`/`setColor`/`history`/`remove`), `ViewNote`/`ViewNoteRevision` (+ RLS org/société), sujet CASL `Note`, `NotesOverlay.tsx` (monté par vue dans `AppShell`) | e2e int (`notes.int.test.ts`) : création visible dans la vue ; édition → historisation (1 révision/modif, no-op ignoré) ; déplacement persisté sans révision ; suppression | ✅ |
| NFR-FON-1/2 | `computeInvoiceTotals`, `nextDocumentNumber` | e2e totaux + numérotation | ✅ |
| NFR-SEC-1 | `rls.sql`, rôle `jampack_app` | RLS actif au boot (policies vérifiées) | ✅ |
| NFR-SEC-3 | `authed()` | mutations FORBIDDEN sans droit | ✅ |
| NFR-MNT-1 | `packages/domain` (Zod partagé) | typecheck 5 packages verts | ✅ |
| NFR-MNT-3 | `.github/workflows/ci.yml` | install→migrate→seed→lint→typecheck→test:cov (≥90 %)→test:int→build | ✅ |

## Couverture
- Exigences **Must** livrées : socle, CRM, référentiels, ventes (dont génération Factur-X + connecteur PDP), achats, stock, comptabilité/FEC.
- Restant sur FR-VEN-8 : non pas du code mais un **choix réglementaire/business** — immatriculation PDP DGFiP + raccordement PPF **ou** branchement d'une PDP partenaire (hors périmètre logiciel).
- Chaque feature livrée dispose d'un e2e via les vrais routers tRPC (RLS actif) — voir historique git.
