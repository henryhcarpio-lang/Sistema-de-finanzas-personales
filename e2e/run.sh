#!/usr/bin/env bash
# Ejecuta las pruebas end-to-end contra la app en BASE_URL (por defecto http://localhost:3000).
# Variables necesarias: E2E_EMAIL, E2E_PASSWORD (cuenta de prueba confirmada) y las de .env.local.
# ¡Cada suite vacía la cuenta de prueba! No uses tu cuenta real.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env.local ] && . ./.env.local; set +a
mkdir -p e2e/capturas
estado=0
for f in e2e/fase*.mjs; do
  echo "== $f =="
  node "$f" || estado=1
done
exit $estado
