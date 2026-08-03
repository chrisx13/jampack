import { router } from './trpc';
import { crmRouter } from '../crm/crm.router';
import { iamRouter } from '../iam/iam.router';
import { societeRouter } from '../societe/societe.router';
import { catalogRouter } from '../catalog/catalog.router';
import { settingsRouter } from '../settings/settings.router';
import { invoiceRouter } from '../invoice/invoice.router';
import { quoteRouter } from '../invoice/quote.router';
import { creditNoteRouter } from '../invoice/creditNote.router';
import { paymentRouter } from '../invoice/payment.router';
import { billingRouter } from '../billing/billing.router';
import { stockRouter } from '../stock/stock.router';
import { purchaseRouter } from '../purchases/purchase.router';
import { supplierInvoiceRouter } from '../purchases/supplierInvoice.router';
import { accountingRouter } from '../accounting/accounting.router';

export const appRouter = router({
  crm: crmRouter,
  iam: iamRouter,
  societes: societeRouter,
  catalog: catalogRouter,
  settings: settingsRouter,
  quotes: quoteRouter,
  invoices: invoiceRouter,
  creditNotes: creditNoteRouter,
  payments: paymentRouter,
  billing: billingRouter,
  stock: stockRouter,
  purchases: purchaseRouter,
  supplierInvoices: supplierInvoiceRouter,
  accounting: accountingRouter,
});

/** Type consommé par les clients (web, desktop, mobile) pour la type-safety. */
export type AppRouter = typeof appRouter;
