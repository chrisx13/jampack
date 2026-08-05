-- Lien de paiement en ligne (fourni par le prestataire du vendeur) porté sur la facture.
ALTER TABLE "Invoice" ADD COLUMN "paymentUrl" TEXT;
