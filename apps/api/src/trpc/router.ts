import { router } from './trpc';
import { crmRouter } from '../crm/crm.router';
import { iamRouter } from '../iam/iam.router';
import { societeRouter } from '../societe/societe.router';
import { catalogRouter } from '../catalog/catalog.router';
import { settingsRouter } from '../settings/settings.router';
import { invoiceRouter } from '../invoice/invoice.router';
import { quoteRouter } from '../invoice/quote.router';
import { publicQuoteRouter } from '../invoice/publicQuote.router';
import { creditNoteRouter } from '../invoice/creditNote.router';
import { paymentRouter } from '../invoice/payment.router';
import { recurringRouter } from '../invoice/recurring.router';
import { timeRouter } from '../invoice/time.router';
import { billingRouter } from '../billing/billing.router';
import { stockRouter } from '../stock/stock.router';
import { purchaseRouter } from '../purchases/purchase.router';
import { supplierInvoiceRouter } from '../purchases/supplierInvoice.router';
import { supplierPaymentRouter } from '../purchases/supplierPayment.router';
import { accountingRouter } from '../accounting/accounting.router';
import { expensesRouter } from '../expenses/expenses.router';
import { analyticsRouter } from '../analytics/analytics.router';
import { auditRouter } from '../iam/audit.router';
import { notesRouter } from '../notes/notes.router';
import { documentsRouter } from '../documents/documents.router';

export const appRouter = router({
  crm: crmRouter,
  iam: iamRouter,
  societes: societeRouter,
  catalog: catalogRouter,
  settings: settingsRouter,
  quotes: quoteRouter,
  publicQuote: publicQuoteRouter,
  invoices: invoiceRouter,
  creditNotes: creditNoteRouter,
  payments: paymentRouter,
  recurring: recurringRouter,
  timeEntries: timeRouter,
  billing: billingRouter,
  stock: stockRouter,
  purchases: purchaseRouter,
  supplierInvoices: supplierInvoiceRouter,
  supplierPayments: supplierPaymentRouter,
  accounting: accountingRouter,
  expenses: expensesRouter,
  analytics: analyticsRouter,
  audit: auditRouter,
  notes: notesRouter,
  documents: documentsRouter,
});

/** Type consommé par les clients (web, desktop, mobile) pour la type-safety. */
export type AppRouter = typeof appRouter;
