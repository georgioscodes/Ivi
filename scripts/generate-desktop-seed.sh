#!/usr/bin/env bash
#
# Regenerates the demo data the desktop build ships with.
#
# seed-demo-data.sh is the single source of truth for what the demo data *is*. The desktop app
# cannot run it — the practitioner's machine has no bash, curl or jq — so this dumps the result
# of a seeding run into SQL that the launcher can execute directly.
#
#   docker compose up -d
#   ./gradlew bootRun                       # in another terminal
#   ./scripts/seed-demo-data.sh --reset
#   ./scripts/generate-desktop-seed.sh
#
# Output: src/desktop/resources/demo-data.sql
#
# The generated script truncates and reloads rather than inserting into an empty schema. That
# makes it idempotent, which is what lets the desktop app offer "Reset demo data" — and it means
# the reference data Flyway inserts (the food catalogue in V5, the measurement types in V7) is
# replaced wholesale rather than colliding with the dump.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT="$REPO_ROOT/src/desktop/resources/demo-data.sql"

DB_CONTAINER="${IVI_DB_CONTAINER:-ivi-postgres}"
DB_USER="${DB_USERNAME:-ivi}"
DB_NAME="${DB_NAME:-ivi}"

# Tables holding demo data. Deliberately excluded:
#   flyway_schema_history  — the desktop database builds its own by running the migrations
#   spring_session*        — live sessions from the seeding run, meaningless elsewhere
#   login_attempt          — rate-limiter state, likewise
TABLES=(
    practitioner client food food_portion food_suggestion measurement measurement_type
    journal_entry plan plan_day plan_meal plan_item audit_log
)

DEMO_EMAIL="${IVI_EMAIL:-ivitester@maildrop.cc}"
SCRATCH_DB="ivi_desktop_seed_build"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    echo "Database container '$DB_CONTAINER' is not running." >&2
    echo "Start it with: docker compose up -d" >&2
    exit 1
fi

psql_run() { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" "$@"; }
psql_scratch() { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$SCRATCH_DB" -v ON_ERROR_STOP=1 "$@"; }

clients=$(psql_run -tAc "SELECT count(*) FROM client")
if [ "$clients" = "0" ]; then
    echo "The database has no clients in it — nothing worth dumping." >&2
    echo "Run ./scripts/seed-demo-data.sh --reset first." >&2
    exit 1
fi

# A development database usually holds more than the demo account — other practitioners created
# while testing, each with their own clients. Dumping the database as it stands would ship all of
# it. So the dump is taken from a throwaway copy with everything but the demo account deleted,
# which leaves the real development database untouched.
echo "Building a filtered copy in $SCRATCH_DB ..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -q \
    -c "DROP DATABASE IF EXISTS $SCRATCH_DB" \
    -c "CREATE DATABASE $SCRATCH_DB OWNER $DB_USER" > /dev/null
cleanup() {
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -q \
        -c "DROP DATABASE IF EXISTS $SCRATCH_DB" > /dev/null 2>&1 || true
}
trap cleanup EXIT

docker exec -i "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges \
    | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$SCRATCH_DB" -q > /dev/null

demo_id=$(psql_scratch -tAc "SELECT id FROM practitioner WHERE email = '$DEMO_EMAIL'")
if [ -z "$demo_id" ]; then
    echo "No practitioner with email $DEMO_EMAIL in the database." >&2
    echo "Run ./scripts/seed-demo-data.sh --reset first." >&2
    exit 1
fi
echo "  demo practitioner id $demo_id"

# Nothing cascades from practitioner — deleting one is deliberately not a one-liner, so that a
# stray delete cannot take a practice's records with it. Here that means an explicit sweep, in
# dependency order. Catalogue foods (practitioner_id IS NULL) stay; they are reference data.
psql_scratch -q <<SQL > /dev/null
DELETE FROM audit_log       WHERE practitioner_id <> $demo_id;
DELETE FROM measurement     WHERE practitioner_id <> $demo_id;
DELETE FROM journal_entry   WHERE practitioner_id <> $demo_id;
DELETE FROM plan            WHERE practitioner_id <> $demo_id;
DELETE FROM food_suggestion WHERE practitioner_id <> $demo_id;
DELETE FROM food            WHERE practitioner_id IS NOT NULL AND practitioner_id <> $demo_id;
DELETE FROM client          WHERE practitioner_id <> $demo_id;
DELETE FROM practitioner    WHERE id <> $demo_id;
TRUNCATE spring_session, spring_session_attributes, login_attempt CASCADE;
SQL

removed=$(psql_run -tAc "SELECT count(*) FROM practitioner WHERE email <> '$DEMO_EMAIL'")
[ "$removed" -gt 0 ] && echo "  excluded $removed other practitioner(s) and their records"

mkdir -p "$(dirname "$OUTPUT")"

{
    cat <<'HEADER'
-- Demo data for the desktop preview build. GENERATED FILE — DO NOT EDIT BY HAND.
--
-- Regenerate with scripts/generate-desktop-seed.sh, which dumps a database seeded by
-- scripts/seed-demo-data.sh. That script is where the data is actually defined; this is a
-- transport format for it.
--
-- Everything here is fabricated. No part of it describes a real person.
--
-- Safe to run more than once: it truncates before loading, which is what makes the desktop
-- app's "Reset demo data" work. It also replaces the reference data inserted by migrations
-- V5 and V7, so the result matches the development database exactly.

BEGIN;

-- Foreign keys are checked per statement, and a data-only dump is not guaranteed to be ordered
-- so that every parent lands before its children. Deferring the checks for the load sidesteps
-- the ordering question entirely. The embedded server runs as superuser, so this is permitted.
SET session_replication_role = replica;

HEADER

    printf 'TRUNCATE %s RESTART IDENTITY CASCADE;\n\n' "$(IFS=,; echo "${TABLES[*]}")"

    dump_args=(--data-only --inserts --no-owner --no-privileges --no-comments)
    for table in "${TABLES[@]}"; do
        dump_args+=(--table="public.$table")
    done

    # pg_dump emits its own session settings, including an empty search_path. Stripping the
    # noise keeps the generated file readable; the INSERTs it produces are schema-qualified, so
    # they do not depend on any of it.
    docker exec -i "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$SCRATCH_DB" "${dump_args[@]}" \
        | grep -vE "^(SET |SELECT pg_catalog\.set_config|--$|-- Dumped|-- PostgreSQL database dump)" \
        | cat -s

    cat <<'FOOTER'

SET session_replication_role = DEFAULT;
SET search_path = public;

-- Every id column is GENERATED BY DEFAULT AS IDENTITY. The rows above carry explicit ids, which
-- does not advance the underlying sequences, so without this the first row the practitioner
-- creates collides with an existing id. Driven off the catalogue rather than a fixed list, so a
-- new table does not silently miss out.
DO $$
DECLARE
    identity_column RECORD;
BEGIN
    FOR identity_column IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND is_identity = 'YES'
    LOOP
        EXECUTE format(
            'SELECT setval(pg_get_serial_sequence(%L, %L), GREATEST(COALESCE((SELECT MAX(%I) FROM public.%I), 0), 1))',
            identity_column.table_name, identity_column.column_name,
            identity_column.column_name, identity_column.table_name);
    END LOOP;
END $$;

COMMIT;
FOOTER
} > "$OUTPUT"

rows=$(grep -c '^INSERT INTO' "$OUTPUT" || true)
printf 'Wrote %s\n  %s rows across %s tables, %s\n' \
    "${OUTPUT#"$REPO_ROOT"/}" "$rows" "${#TABLES[@]}" "$(du -h "$OUTPUT" | cut -f1 | tr -d ' ')"
