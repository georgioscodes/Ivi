#!/usr/bin/env bash
#
# Shared HTTP helpers for the scripts in this directory.
#
# The API authenticates with a server-side session cookie and protects mutations with CSRF, so
# every call has to carry the session cookie *and* echo the XSRF-TOKEN cookie back in the
# X-XSRF-TOKEN header. One curl cookie jar, read and written by every request, covers both.
#
# Source this, do not execute it.

BASE_URL="${IVI_BASE_URL:-http://localhost:8080}"

# Per-run scratch space: cookie jar, last status, cached plan bodies. Removed on exit, so a
# session cookie for a real account never outlives the run.
IVI_WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ivi-seed.XXXXXX")"
trap 'rm -rf "$IVI_WORK_DIR"' EXIT

COOKIE_JAR="$IVI_WORK_DIR/cookies.txt"
STATUS_FILE="$IVI_WORK_DIR/last-status"

# The CSRF token is re-read from the jar on every call rather than cached: the server issues a
# fresh one when the session id rotates at login.
csrf_token() { awk '$6 == "XSRF-TOKEN" { print $7 }' "$COOKIE_JAR" 2>/dev/null | tail -1; }

# api METHOD PATH [JSON_BODY]
#
# Writes the response body to stdout and the HTTP status to $STATUS_FILE. The status goes
# through a file because callers capture the body with $(...), which runs api in a subshell —
# a shell variable set in there would not survive back to the caller.
api() {
    local method="$1" path="$2" body="${3:-}"
    local response

    if [ -n "$body" ]; then
        response=$(curl -sS -w '\n%{http_code}' \
            -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
            -X "$method" "$BASE_URL$path" \
            -H "Content-Type: application/json" \
            -H "X-XSRF-TOKEN: $(csrf_token)" \
            -d "$body")
    else
        response=$(curl -sS -w '\n%{http_code}' \
            -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
            -X "$method" "$BASE_URL$path" \
            -H "X-XSRF-TOKEN: $(csrf_token)")
    fi

    printf '%s' "${response##*$'\n'}" > "$STATUS_FILE"
    printf '%s' "${response%$'\n'*}"
}

# Status of the most recent api call.
api_status() { cat "$STATUS_FILE" 2>/dev/null; }

# Obtain the initial CSRF cookie. Any endpoint issues one; health is public and cheap.
bootstrap_session() {
    rm -f "$COOKIE_JAR"
    curl -sS -c "$COOKIE_JAR" -o /dev/null "$BASE_URL/actuator/health"
}

require_server() {
    if ! curl -sS -f -o /dev/null "$BASE_URL/actuator/health" 2>/dev/null; then
        echo "No server at $BASE_URL" >&2
        echo "Start one with:  docker compose up -d && ./gradlew bootRun" >&2
        echo "Or point elsewhere with IVI_BASE_URL." >&2
        return 1
    fi
}
