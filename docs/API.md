# API Reference (tRPC)

**Projet :** JAMPACK · **Contrat :** `apps/api/src/trpc/router.ts` (type `AppRouter`) · **Version :** 1.0

API **type-safe** tRPC (superjson). Le type `AppRouter` est consommé par le front → typage bout-en-bout.
Contexte : utilisateur authentifié (OIDC) + société active ; en-têtes `x-org-id`, `x-societe-id`.
Autorisation via `authed(action, subject)` (CASL). Toutes les procédures s'exécutent dans une
transaction RLS (`withTenant`).

## Routeurs

### `crm`
`companies.{list,create,update,remove}` · `contacts.*` · `establishments.{list,create}` · `opportunities.{list,create,update,move}` · `activities.create`

### `catalog`
`products.{list,create,update,remove}` · `taxRates.{list,create,update,remove}` · `categories.{list,create,update,archive}` · `sequences.list`

### `quotes` / `invoices` / `creditNotes` (pièces de vente)
Commun (`makeSalesRouter`) : `list · get · create · update · validate · cancel · pdf`
- `quotes` : + `accept · refuse · convertToInvoice`
- `invoices` : + `createCreditNote`

### `payments`
`listForInvoice · create · remove · echeancier` (recalcule le statut *payée* de la facture)

### `purchases`
`suppliers` · `orders.{list,get,create,update,validate,cancel,receive}` (la réception génère les entrées de stock)

### `supplierInvoices`
`list · get · create · update · validate · markPaid · markUnpaid · cancel · echeancier`

### `stock`
`warehouses.{list,create,update,archive}` · `movements.{list,create,remove}` · `levels`

### `billing`
`addresses.*` · `factors.*` · `bankAccounts.*` · `paymentTerms.*`

### `societes` / `iam` / `settings`
`societes.{list,active,settings,updateSettings}` · `iam.{me,members}` · `settings.{getTheme,setTheme}`

## Conventions
- **Lecture** : `query` ; **écriture** : `mutation`. Entrées validées par Zod (`packages/domain`).
- Erreurs tRPC : `UNAUTHORIZED` (pas de session), `FORBIDDEN` (droit manquant), `BAD_REQUEST` (règle métier).
- Une **API REST/OpenAPI** pourra être ajoutée à côté pour les intégrations tierces (ADR-3).
