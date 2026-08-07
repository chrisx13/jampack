-- Métrage du coût fournisseur (Anthropic) sur le grand livre des crédits IA : modèle + tokens.
ALTER TABLE "AiCreditLedger" ADD COLUMN "model" TEXT;
ALTER TABLE "AiCreditLedger" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "AiCreditLedger" ADD COLUMN "outputTokens" INTEGER;
ALTER TABLE "AiCreditLedger" ADD COLUMN "cacheReadTokens" INTEGER;
