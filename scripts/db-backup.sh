#!/usr/bin/env bash
# Sauvegarde de la base JAMPACK via pg_dump (conteneur "db"), avec rotation.
# Usage : scripts/db-backup.sh [dossier_destination]
#   - dump compressé horodaté : jampack-YYYYmmdd-HHMMSS.sql.gz
#   - rétention : KEEP_DAILY quotidiennes (défaut 7). Adapter/pousser hors serveur (S3, etc.).
set -euo pipefail

DEST="${1:-./backups}"
KEEP_DAILY="${KEEP_DAILY:-7}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-jampack}"
DB_NAME="${DB_NAME:-jampack}"

mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/jampack-$STAMP.sql.gz"

echo "▶ Dump $DB_NAME → $OUT"
docker compose exec -T "$DB_SERVICE" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip -9 > "$OUT"

# Vérification minimale d'intégrité de l'archive.
gzip -t "$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"
echo "✔ Sauvegarde OK ($SIZE)"

# Rotation : ne garder que les KEEP_DAILY plus récentes.
ls -1t "$DEST"/jampack-*.sql.gz 2>/dev/null | tail -n +"$((KEEP_DAILY + 1))" | while read -r old; do
  echo "  rotation : suppression de $old"; rm -f "$old"
done

echo "ℹ Restauration : scripts/db-restore.sh $OUT"
echo "⚠ Pousser aussi la sauvegarde HORS du serveur (règle 3-2-1) et TESTER une restauration régulièrement."
