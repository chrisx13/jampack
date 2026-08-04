-- Probabilité de conversion par étape (%) pour la valeur pondérée du pipeline
ALTER TABLE "PipelineStage" ADD COLUMN "probability" INTEGER NOT NULL DEFAULT 50;

-- Valeurs par défaut usuelles selon l'avancement (les étapes personnalisées gardent 50 %).
UPDATE "PipelineStage" SET "probability" = 10  WHERE "name" = 'Prospect';
UPDATE "PipelineStage" SET "probability" = 40  WHERE "name" = 'Qualifie';
UPDATE "PipelineStage" SET "probability" = 70  WHERE "name" = 'Proposition';
UPDATE "PipelineStage" SET "probability" = 100 WHERE "name" = 'Gagne';
UPDATE "PipelineStage" SET "probability" = 0   WHERE "name" = 'Perdu';
