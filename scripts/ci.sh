#!/usr/bin/env bash
# Lance la CI conteneurisée (Docker) et propage son code de sortie ; nettoie ensuite.
set -uo pipefail
cd "$(dirname "$0")/.."

docker compose -f docker-compose.ci.yml up --build --abort-on-container-exit --exit-code-from ci
code=$?

docker compose -f docker-compose.ci.yml down -v >/dev/null 2>&1 || true
exit $code
