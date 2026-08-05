#!/usr/bin/env bash
# Restauration d'une sauvegarde JAMPACK (fichier .sql.gz produit par db-backup.sh).
# Usage : scripts/db-restore.sh <fichier.sql.gz>
# ⚠ DESTRUCTIF : écrase le contenu de la base cible. Toujours restaurer d'abord sur un
#   environnement de TEST. Confirmation explicite requise.
set -euo pipefail

FILE="${1:?Usage: scripts/db-restore.sh <fichier.sql.gz>}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-jampack}"
DB_NAME="${DB_NAME:-jampack}"

[ -f "$FILE" ] || { echo "Fichier introuvable : $FILE" >&2; exit 1; }
gzip -t "$FILE"

echo "⚠ Cette opération va ÉCRASER la base '$DB_NAME'."
read -r -p "Taper 'RESTORE' pour confirmer : " ans
[ "$ans" = "RESTORE" ] || { echo "Annulé."; exit 1; }

echo "▶ Restauration de $FILE → $DB_NAME"
gunzip -c "$FILE" | docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 >/dev/null
echo "✔ Restauration terminée. Réappliquer si besoin le RLS/GRANT (l'entrypoint de l'API le fait au boot)."
