# API Reference (tRPC)

**Projet :** JAMPACK · **Contrat :** `apps/api/src/trpc/router.ts` (type `AppRouter`) · **Version :** 1.0

API **type-safe** tRPC (superjson). Le type `AppRouter` est consommé par le front → typage bout-en-bout.
Contexte : utilisateur authentifié (OIDC/Keycloak) + société active ; en-têtes `x-org-id`, `x-societe-id`.
Autorisation via `authed(action, subject)` (CASL). Toutes les procédures s'exécutent dans une
transaction RLS (`withTenant`).

## Routeurs

### `crm`
`companies.{list,create,update,remove,exportData,anonymize,purgeCandidates}` (exportData = export RGPD ; anonymize = effacement art. 17 ; purgeCandidates = tiers > 3 ans à purger) · `contacts.{list,create,update,remove}` · `establishments.{list,create,update,remove}` · `opportunities.{list,create,update,move,remove,pipelineSummary}` (pipelineSummary = nombre/montant/montant pondéré par étape) · `stages.list` (avec probabilité de conversion) · `activities.{list,tasks,create,complete,reopen,remove}` (list filtrable par client/contact/opportunité ; tasks = tâches ouvertes triées par échéance ; complete/reopen = état fait)

### `catalog`
`products.{list,create,update,remove,importCsv}` (importCsv = upsert par référence depuis un CSV `réf ; nom ; prix HT ; unité ; type`) · `taxRates.{list,create,update,remove}` · `categories.{list,create,update,archive}` · `sequences.list`

### `quotes` / `invoices` / `creditNotes` (pièces de vente)
Commun (`makeSalesRouter`) : `list · get · create · update · validate · cancel · duplicate · pdf` (duplicate = copie en brouillon)
- `quotes` : + `accept · refuse · convertToInvoice · createDepositInvoice · expiring · publicLink` (publicLink = lien public de signature du devis)
- `publicQuote` (**public, sans authentification**) : `get · accept` — consultation et acceptation d'un devis via son jeton ; accès restreint par la policy RLS `public_quote_token` (une seule pièce visible)
- `invoices` : + `createCreditNote · facturx · sendToPdp · transmissions`

### `recurring`
Factures récurrentes (abonnements). `list · create · update · remove · generateDue`.
`generateDue` crée en brouillon les factures des modèles actifs dont l'échéance est atteinte (rattrapage des périodes) et avance `nextRunAt`. Génération à la demande — sans cron externe.

### `timeEntries`
Suivi du temps (facturation au temps). `list · create · update · remove · invoiceForCompany`.
`invoiceForCompany` génère une facture brouillon depuis les temps ouverts + facturables d'un client (une ligne par temps : durée × taux) et marque ces temps « facturés ».

### `payments`
`listForInvoice · create · remove · echeancier · reminders · recordReminder · reminderLetter` (recalcule le statut *payée* ; relances = factures échues non soldées, incrément de niveau, lettre de relance texte)

### `purchases`
`suppliers` · `orders.{list,get,create,update,validate,cancel,duplicate,receive,receivePartial,overdue}` (duplicate = copie en brouillon) (receive = tout réceptionner ; receivePartial = livraisons échelonnées par ligne, statut *partial* → *received* ; overdue = commandes envoyées/partielles en retard de livraison)

### `supplierInvoices`
`list · get · create · fromOrder · update · validate · markPaid · markUnpaid · cancel · echeancier · match` (fromOrder = brouillon pré-rempli depuis une commande ; match = rapprochement 3 voies commande/réception/facture)

### `supplierPayments`
`listForInvoice · create · remove` (recalcule le statut *payée* de la facture fournisseur)

### `stock`
`warehouses.{list,create,update,archive}` · `movements.{list,create,remove,transfer}` (transfer = transfert inter-entrepôts atomique) · `levels` · `exportLevels` (CSV des niveaux) · `valuation` (`{method:'pmp'|'fifo'}`) · `inventory` (comptage → ajustement) · `lowStock` (articles sous le seuil de réappro.) · `lots` (soldes par lot/série + péremption)

### `accounting`
`accounts.{list,create,update,initPcg}` · `journals.{list,create,initDefaults}` · `fixedAssets.{list,create,update,remove,schedule,postDepreciation}` (immobilisations + plan d'amortissement + comptabilisation de la dotation 681/281) · `entries.{list,get,create,remove,exportCsv}` (exportCsv = journal des écritures en CSV, importable par les logiciels d'expert-comptable — voir [CONNECTEURS-EXPERT-COMPTABLE](CONNECTEURS-EXPERT-COMPTABLE.md)) · `balance` · `ledger` (grand livre d'un compte) · `exportLedger` (CSV du grand livre d'un compte) · `exportBalance` (CSV de la balance) · `incomeStatement` (compte de résultat) · `balanceSheet` (bilan simplifié) · `postSalesInvoice · postPayment · postSupplierInvoice · postSupplierPayment` (génèrent les écritures) · `fec` (export FEC) · `vatReturn` (CA3) · `accountLines · letter · unletter` (lettrage) · `closeVat` · `bankLines · reconcile · importBankStatement` (rapprochement bancaire + import de relevé CSV)

### `expenses`
Notes de frais (dépenses salariés). `list · create · update · remove · validate · post · markReimbursed`.
`post` génère l'écriture comptable (charge 6xx + TVA déductible 44566 au débit, 421 dû au salarié au crédit ; comptes créés au besoin), idempotente.

### `analytics`
`summary` (KPI : CA, encours clients/fournisseurs, valeur stock, TVA) · `tresorerie` (prévisionnel encaissements/décaissements) · `agedReceivables` / `agedPayables` (balance âgée clients / fournisseurs par tranche) · `cashflowForecast` (`{weeks?}` : prévisionnel hebdomadaire encaissements/décaissements + position cumulée) · `agenda` (`{days?}` : échéances & tâches à venir — tâches CRM, factures clients/fournisseurs, livraisons ; retards signalés) · `agendaIcs` (`{days?}` : même agenda en iCalendar .ics)

### `audit`
`list` (dernières entrées du journal d'audit du compte) · `exportCsv` (export CSV du journal, jusqu'à 5000 entrées)

### `notes`
Pense-bêtes partagés par vue (`viewKey`) et par société. `list · create · edit · move · setColor · history · remove`.
`edit` historise le contenu (une `ViewNoteRevision` par modification) ; `move` persiste la position (déplacement) ;
`history` renvoie les révisions (récent → ancien). Visibles par tout utilisateur ayant le droit `read Note`.

### `billing`
`addresses.*` · `factors.*` · `bankAccounts.*` · `paymentTerms.*`

### `societes` / `iam` / `settings`
`societes.{list,active,listAll,create,settings,updateSettings}` · `iam.{me,members,roles,societes,invite,grantRole,revokeRole}` · `settings.{getTheme,setTheme}`

## Conventions
- **Lecture** : `query` ; **écriture** : `mutation`. Entrées validées par Zod (`packages/domain`).
- Erreurs tRPC : `UNAUTHORIZED` (pas de session), `FORBIDDEN` (droit manquant), `BAD_REQUEST` (règle métier).
- Une **API REST/OpenAPI** pourra être ajoutée à côté pour les intégrations tierces (ADR-3).
