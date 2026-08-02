#!/usr/bin/env bash
# Vérifie l'isolation RLS à DEUX niveaux (compte + société), en se connectant avec un
# rôle NON-propriétaire (sinon le propriétaire contourne le RLS).
#   DATABASE_URL      : URL propriétaire (migrations / seed / rls)  — bypass RLS
#   APP_DATABASE_URL  : URL rôle applicatif jampack_app             — RLS appliqué
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL requis}"
: "${APP_DATABASE_URL:?APP_DATABASE_URL requis}"

owner() { psql "$DATABASE_URL" -Atqc "$1"; }
# Exécute en rôle applicatif avec app.current_org (+ éventuellement app.current_societe).
app() { # $1=sql  $2=org  [$3=societe]
  local pre="SET app.current_org='$2';"
  [ "${3:-}" != "" ] && pre="$pre SET app.current_societe='$3';"
  psql "$APP_DATABASE_URL" -Atqc "$pre $1"
}

ORG=$(owner "SELECT id FROM \"Organization\" ORDER BY \"createdAt\" LIMIT 1;")
A=$(owner "SELECT id FROM \"Societe\" WHERE \"organizationId\"='$ORG' AND name LIKE 'Boulangerie%' LIMIT 1;")
B=$(owner "SELECT id FROM \"Societe\" WHERE \"organizationId\"='$ORG' AND name LIKE 'Studio%' LIMIT 1;")
CA=$(owner "SELECT count(*) FROM \"Company\" WHERE \"societeId\"='$A';")
CB=$(owner "SELECT count(*) FROM \"Company\" WHERE \"societeId\"='$B';")
TOTAL=$((CA + CB))

echo "org=$ORG  A(boulangerie) companies=$CA  B(studio) companies=$CB"

fail=0
check() { # $1=label $2=expected $3=got
  if [ "$2" = "$3" ]; then echo "  PASS  $1 (=$3)"; else echo "  FAIL  $1 attendu=$2 obtenu=$3"; fail=1; fi
}

# 1) Consolidé (pas de société active) : voit toutes les sociétés du compte
check "consolidé = A+B"        "$TOTAL" "$(app "SELECT count(*) FROM \"Company\";" "$ORG")"
# 2) Société A active : ne voit que A
check "société A ⇒ A"          "$CA"    "$(app "SELECT count(*) FROM \"Company\";" "$ORG" "$A")"
# 3) Société B active : ne voit que B
check "société B ⇒ B"          "$CB"    "$(app "SELECT count(*) FROM \"Company\";" "$ORG" "$B")"
# 4) Étanchéité : société B active ⇒ 0 ligne de la société A
check "B actif ⇒ 0 ligne de A" "0"      "$(app "SELECT count(*) FROM \"Company\" WHERE \"societeId\"='$A';" "$ORG" "$B")"
# 5) Isolation COMPTE conservée : un autre compte inexistant ⇒ 0
check "compte inconnu ⇒ 0"     "0"      "$(app "SELECT count(*) FROM \"Company\";" "00000000-0000-0000-0000-000000000000")"

[ "$fail" = "0" ] && echo "== RLS OK : isolation compte + société vérifiée ==" || { echo "== RLS ÉCHEC =="; exit 1; }
