-- Autoliquidation de TVA (TVA due par le preneur) par facture — REG-5/REG-7.
ALTER TABLE "Invoice" ADD COLUMN "vatReverseCharge" BOOLEAN NOT NULL DEFAULT false;
