#!/usr/bin/env bash
# Vérification de bout en bout sur le build web :
# base de test → build → serveurs → 5 vérifications (paiement, service, abonnement + lobby, écrans, serveur) → arrêt.
# Usage (depuis la racine du projet) : npm run e2e        (SKIP_BUILD=1 pour réutiliser dist/)
# Captures et écrans d'échec : tests/e2e/captures/
set -uo pipefail
OUT=tests/e2e/captures
mkdir -p "$OUT"

if [ -z "${CAISSE_DEMO_CODE:-}" ]; then
  echo "Définissez CAISSE_DEMO_CODE (code démo, jamais écrit dans le dépôt), par exemple :"
  echo "  CAISSE_DEMO_CODE=xxxx npm run e2e"
  exit 2
fi
# Mot de passe de l'Espace créateur de la base de TEST : aléatoire à chaque lancement s'il n'est pas fourni.
export CAISSE_DASHBOARD_PASSWORD="${CAISSE_DASHBOARD_PASSWORD:-test-$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')}"

bash tests/e2e/setup-db.sh || exit 1
[ -d tests/e2e/node_modules/pg ] || (cd tests/e2e && npm install --silent --no-audit --no-fund) || exit 1
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  # Build de test : serveur de licences = serveur local de test (jamais le vrai serveur).
  EXPO_PUBLIC_LICENSE_URL=http://localhost:8790 EXPO_PUBLIC_LICENSE_KEY=cle-publique-de-test \
    EXPO_OFFLINE=1 CI=1 npx expo export --platform web --output-dir dist >/dev/null || exit 1
fi

node tests/e2e/serve.js dist >/dev/null &
WEB=$!
node tests/e2e/rest-server.js >/dev/null &
API=$!
trap 'kill $WEB $API 2>/dev/null' EXIT
sleep 1

FAIL=0
# serveur-licences en dernier : il termine par le test du blocage du mot de passe.
for s in scenario-paiement scenario-service scenario-abonnement-lobby responsive serveur-licences; do
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
