# Modèle de données

**Projet :** JAMPACK · **Source de vérité :** `packages/db/prisma/schema.prisma` · **Version :** 1.0

## 1. Hiérarchie de tenancy
`Organization` (compte/tenant) ▸ `Societe` (entité juridique) ▸ données métier.
Toute table métier porte `organizationId` (+ `societeId` le cas échéant). Isolation par **RLS**
(`packages/db/prisma/rls.sql`).

## 2. Entités par domaine

### Socle & IAM
- `Organization` (theme JSON) · `User` · `Membership` (accès compte, sans rôle) · `Role` · `Permission`
  (action×subject) · `SocieteRole` (userId×societeId×roleId — **rôles par société cumulables**) ·
  `AuditLog` (trace des mutations tRPC : `action`, `userId`, `metadata`).

### CRM
- `Company` (`isCustomer`/`isSupplier`, `factorId`, `paymentTermId`) · `Contact` · `Establishment`
  (siège/facturation/livraison) · `PipelineStage` · `Opportunity` · `Activity`.

### Référentiels
- `TaxRate` (compte) · `Product` (+ `reorderPoint` = seuil de réappro.) · `ProductCategory` (arbre) · `NumberSequence` (société×docType, atomique).

### Ventes & encaissement
- `Invoice` (**`docType` = devis|facture|avoir**, `status`, `source` self-relation = filiation,
  `factor`/`bankAccount`/`paymentTerm`, `journalEntry` = comptabilisation) · `InvoiceLine` (qty/PU/TVA figés) · `Payment` (rattaché facture).
- Facturation : `SocieteAddress` · `Factor` (affactureur) · `BankAccount` · `PaymentTerm`.
- E-invoicing : `PdpTransmission` (transmission Factur-X via PDP : `provider`, `status`, `providerRef`, sous RLS).

### Achats
- `PurchaseOrder` (supplier=`Company`, `warehouse`, `status`, `number` seq « commande ») ·
  `PurchaseOrderLine` (`quantityReceived`) · `SupplierInvoice` (+ lien `purchaseOrderId`, `journalEntry`) · `SupplierInvoiceLine` ·
  `SupplierPayment` (règlement fournisseur, recalcul du statut *payée*, sous RLS).

### Stock
- `Warehouse` · `StockMovement` (**`quantity` signée**, `kind` entree|sortie|ajustement, `unitCost`).

### Comptabilité
- `Account` (compte PCG, `code`, classe dérivée du 1er chiffre) · `Journal` (`code` VT/AC/BQ/OD, `type`) ·
  `JournalEntry` (rattaché aux factures/règlements comptabilisés) · `JournalEntryLine`
  (`debit`/`credit`, `letter` = code de lettrage).

## 3. Relations clés
- `Invoice.source → Invoice` : traçabilité devis→facture→avoir.
- `PurchaseOrder.receive` → crée des `StockMovement` d'entrée (intégration Achats↔Stock).
- `Payment → Invoice` : recalcul du statut *payée*.
- `Company` est à la fois client (`Invoice.company`) et fournisseur (`PurchaseOrder.supplier`,
  `SupplierInvoice.supplier`).

## 4. Conventions
- Clés `cuid()` ; montants `Decimal(12,2)`, quantités `Decimal(12,3)` ; horodatage `createdAt`/`updatedAt`.
- `organizationId`/`societeId` indexés sur chaque table métier.
- Lignes filles (`*Line`) sans `societeId` propre → protégées via la pièce parente (RLS). TODO durcissement.

## 5. Numérotation
`NumberSequence(societeId, docType)` → préfixe + compteur `nextValue` incrémenté **atomiquement**
(`nextDocumentNumber`, UPDATE…RETURNING). Types : `facture` (FA-), `devis` (DE-), `avoir` (AV-),
`commande` (CM-).

## 6. Migrations
Répertoire `packages/db/prisma/migrations/` (appliquées par `prisma migrate deploy` au boot). Historique :
init → société → rôles → établissements → référentiels → facturation → catégories → thème → billing →
billing_entities → **sales_documents** (docType) → **payments** → **stock** → **purchases** →
**supplier_invoices** → **accounting** → invoice_accounting_link → posting_links → **audit_log** →
**lettrage** → **pdp_transmission** → **supplier_payment** → **product_reorder_point**.

## 7. Schéma (extrait relationnel)
```
Organization 1─* Societe 1─* {Company, Product, Invoice, PurchaseOrder, Warehouse, ...}
Company 1─* Invoice(company)          Company 1─* PurchaseOrder(supplier)
Invoice 1─* InvoiceLine   Invoice 1─* Payment   Invoice 0─1 Invoice(source)   Invoice 1─* PdpTransmission
PurchaseOrder 1─* PurchaseOrderLine   PurchaseOrder 1─* SupplierInvoice   SupplierInvoice 1─* SupplierPayment
Warehouse 1─* StockMovement           Product 1─* StockMovement
Journal 1─* JournalEntry 1─* JournalEntryLine *─1 Account
{Invoice, Payment, SupplierInvoice, SupplierPayment} 0─1 JournalEntry   (comptabilisation)
```
