#!/usr/bin/env bash
# Prépare (une fois) et démarre la base PostgreSQL locale des tests de lobby :
# port 5499, socket dans /var/tmp/caisse-pg, schéma supabase/schema.sql chargé.
# Usage (en root, depuis la racine du projet) : bash tests/e2e/setup-db.sh
set -euo pipefail
DIR=/var/tmp/caisse-pg
BIN=$(dirname "$(ls /usr/lib/postgresql/*/bin/pg_ctl | sort -V | tail -1)")
mkdir -p "$DIR"
chown postgres "$DIR"
as_pg() { su postgres -c "$*"; }

if [ ! -d "$DIR/data" ]; then
  as_pg "$BIN/initdb -D $DIR/data -A trust -U postgres" >/dev/null
fi
if ! as_pg "$BIN/pg_ctl -D $DIR/data status" >/dev/null 2>&1; then
  as_pg "$BIN/pg_ctl -D $DIR/data -l $DIR/log.txt -o '-p 5499 -k $DIR -c listen_addresses=' start" >/dev/null
  sleep 2
fi

PSQL="$BIN/psql -h $DIR -p 5499 -U postgres -v ON_ERROR_STOP=1 -q"
if ! as_pg "$PSQL -d postgres -Atc \"select 1 from pg_database where datname='caisse'\"" | grep -q 1; then
  as_pg "$BIN/createdb -h $DIR -p 5499 -U postgres caisse"
  # Rôles fournis par Supabase, recréés ici pour que le schéma s'exécute à l'identique.
  as_pg "$PSQL -d caisse -c \"create role anon nologin; create role authenticated nologin;\""
fi

# Le schéma est idempotent : il est rechargé à chaque fois pour suivre ses évolutions.
cp supabase/schema.sql "$DIR/schema.sql"
chown postgres "$DIR/schema.sql"
as_pg "$PSQL -d caisse -f $DIR/schema.sql" >/dev/null
echo "Base de test prête (port 5499, socket $DIR)."
