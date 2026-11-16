#!/bin/sh
# The real API on a laptop: a throwaway Postgres built from supabase/migrations, a storage stand-in, and
# the edge function under Deno, then the medicine flow journey against it. Needs Postgres 17 and Deno
# (brew install postgresql@17 deno). Nothing touches the deployed project. See README.md beside this file.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
WORK=${WORK:-/tmp/inrange-local}
PG=${PG:-/opt/homebrew/opt/postgresql@17/bin}
PORT=54329
mkdir -p "$WORK"
[ -f "$WORK/data/PG_VERSION" ] || "$PG/initdb" -D "$WORK/data" -U postgres --auth=trust > /dev/null
"$PG/pg_ctl" -D "$WORK/data" -o "-p $PORT -k ''" -l "$WORK/postgres.log" status > /dev/null 2>&1 \
  || "$PG/pg_ctl" -D "$WORK/data" -o "-p $PORT -k ''" -l "$WORK/postgres.log" start > /dev/null
sleep 1
P="$PG/psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists inrange" -c "create database inrange"
# what Supabase provides that the migrations expect: the API roles and the storage tables
$P -d inrange -c "do \$\$ begin create role anon; exception when duplicate_object then null; end \$\$;" \
  -c "do \$\$ begin create role authenticated; exception when duplicate_object then null; end \$\$;" \
  -c "do \$\$ begin create role service_role; exception when duplicate_object then null; end \$\$;" \
  -c "create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]); create table storage.objects (id uuid, bucket_id text, name text);"
for f in "$REPO"/supabase/migrations/*.sql; do $P -d inrange -f "$f" > /dev/null; done
echo "database ready ($(ls "$REPO"/supabase/migrations/*.sql | wc -l | tr -d ' ') migrations)"

export DB_POOLER_URL="postgres://postgres@127.0.0.1:$PORT/inrange"
export APP_JWT_SECRET=local-test-secret-0123456789abcdef APP_URL=http://localhost:3001
export SUPABASE_URL=http://127.0.0.1:54330 SUPABASE_SERVICE_ROLE_KEY=local
export JOBS_SECRET=local-jobs-secret RAZORPAY_WEBHOOK_SECRET=local-rzp-webhook
export WHATSAPP_APP_SECRET=local-wa-secret WHATSAPP_VERIFY_TOKEN=local-verify
lsof -ti tcp:54330 > /dev/null || (python3 "$HERE/storage_stub.py" 54330 > "$WORK/storage.log" 2>&1 < /dev/null &)
kill $(lsof -ti tcp:8000) 2> /dev/null || true
(cd "$REPO/supabase/functions/api" && deno run -A index.ts > "$WORK/api.log" 2>&1 < /dev/null &)
for i in $(seq 1 40); do curl -s http://127.0.0.1:8000/api/health > /dev/null && break; sleep 2; done
echo "API on http://127.0.0.1:8000 (log: $WORK/api.log)"
[ "$1" = "--serve" ] && exit 0
PSQL_URL="$DB_POOLER_URL" PATH="$PG:$PATH" python3 -u "$REPO/supabase/tests/medicine_flow_journey.py"
