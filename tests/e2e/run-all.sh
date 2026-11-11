#!/usr/bin/env bash
# Vérification de bout en bout sur le build web :
# base de test → build → serveurs → 3 scénarios → arrêt des serveurs.
# Usage (depuis la racine du projet) : npm run e2e        (SKIP_BUILD=1 pour réutiliser dist/)
# Captures et écrans d'échec : tests/e2e/captures/
set -uo pipefail
OUT=tests/e2e/captures
mkdir -p "$OUT"

if [ -z "${CAISSE_ADMIN_CODE:-}" ] || [ -z "${CAISSE_DEMO_CODE:-}" ]; then
  echo "Définissez CAISSE_ADMIN_CODE et CAISSE_DEMO_CODE (jamais écrits dans le dépôt), par exemple :"
  echo "  CAISSE_ADMIN_CODE=xxxxxx CAISSE_DEMO_CODE=xxxx npm run e2e"
  exit 2
fi

bash tests/e2e/setup-db.sh || exit 1
[ -d tests/e2e/node_modules/pg ] || (cd tests/e2e && npm install --silent --no-audit --no-fund) || exit 1
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  EXPO_OFFLINE=1 CI=1 npx expo export --platform web --output-dir dist >/dev/null || exit 1
fi

node tests/e2e/serve.js dist >/dev/null &
WEB=$!
node tests/e2e/rest-server.js >/dev/null &
API=$!
trap 'kill $WEB $API 2>/dev/null' EXIT
sleep 1

FAIL=0
for s in scenario-service scenario-abonnement-lobby responsive; do
  echo "── $s"
  node "tests/e2e/$s.js" "$OUT" 2>&1 | tail -15
  [ "${PIPESTATUS[0]}" = "0" ] || FAIL=1
done

if [ "$FAIL" = "0" ]; then
  echo "E2E : tout est vert."
else
  echo "E2E : ÉCHEC (voir ci-dessus et $OUT/echec-*.png)"
  exit 1
fi
