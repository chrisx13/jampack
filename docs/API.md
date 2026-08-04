# API Reference (tRPC)

**Projet :** JAMPACK · **Contrat :** `apps/api/src/trpc/router.ts` (type `AppRouter`) · **Version :** 1.0

API **type-safe** tRPC (superjson). Le type `AppRouter` est consommé par le front → typage bout-en-bout.
Contexte : utilisateur authentifié (OIDC/Keycloak) + société active ; en-têtes `x-org-id`, `x-societe-id`.
Autorisation via `authed(action, subject)` (CASL). Toutes les procédures s'exécutent dans une
transaction RLS (`withTenant`).

## Routeurs

### `crm`
`companies.{list,create,update,remove,exportData,anonymize}` (exportData = export RGPD ; anonymize = effacement art. 17) · `contacts.{list,create,update,remove}` · `establishments.{list,create,update,remove}` · `opportunities.{list,create,update,move,remove}` · `stages.list` · `activities.{list,create}`

### `catalog`
`products.{list,create,update,remove}` · `taxRates.{list,create,update,remove}` · `categories.{list,create,update,archive}` · `sequences.list`

### `quotes` / `invoices` / `creditNotes` (pièces de vente)
Commun (`makeSalesRouter`) : `list · get · create · update · validate · cancel · pdf`
- `quotes` : + `accept · refuse · convertToInvoice`
- `invoices` : + `createCreditNote · facturx · sendToPdp · transmissions`

### `payments`
`listForInvoice · create · remove · echeancier` (recalcule le statut *payée* de la facture)

### `purchases`
`suppliers` · `orders.{list,get,create,update,validate,cancel,receive}` (la réception génère les entrées de stock)

### `supplierInvoices`
`list · get · create · update · validate · markPaid · markUnpaid · cancel · echeancier · match` (match = rapprochement 3 voies commande/réception/facture)

### `supplierPayments`
`listForInvoice · create · remove` (recalcule le statut *payée* de la facture fournisseur)

### `stock`
`warehouses.{list,create,update,archive}` · `movements.{list,create,remove}` · `levels` · `valuation` (`{method:'pmp'|'fifo'}`) · `inventory` (comptage → ajustement) · `lowStock` (articles sous le seuil de réappro.) · `lots` (soldes par lot/série + péremption)

### `accounting`
`accounts.{list,create,update,initPcg}` · `journals.{list,create,initDefaults}` · `entries.{list,get,create,remove}` · `balance` · `postSalesInvoice · postPayment · postSupplierInvoice · postSupplierPayment` (génèrent les écritures) · `fec` (export FEC) · `vatReturn` (CA3) · `accountLines · letter · unletter` (lettrage) · `closeVat` · `bankLines · reconcile · importBankStatement` (rapprochement bancaire + import de relevé CSV)

### `analytics`
`summary` (KPI : CA, encours clients/fournisseurs, valeur stock, TVA) · `tresorerie` (prévisionnel encaissements/décaissements)

### `audit`
`list` (dernières entrées du journal d'audit du compte)

### `billing`
`addresses.*` · `factors.*` · `bankAccounts.*` · `paymentTerms.*`

### `societes` / `iam` / `settings`
`societes.{list,active,listAll,create,settings,updateSettings}` · `iam.{me,members,roles,societes,invite,grantRole,revokeRole}` · `settings.{getTheme,setTheme}`

## Conventions
- **Lecture** : `query` ; **écriture** : `mutation`. Entrées validées par Zod (`packages/domain`).
- Erreurs tRPC : `UNAUTHORIZED` (pas de session), `FORBIDDEN` (droit manquant), `BAD_REQUEST` (règle métier).
- Une **API REST/OpenAPI** pourra être ajoutée à côté pour les intégrations tierces (ADR-3).
