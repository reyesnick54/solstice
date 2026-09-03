#!/usr/bin/env bash
# Daily PostgreSQL backup for the SunRey Hetzner sandbox stack.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${SUNREY_SANDBOX_COMPOSE_FILE:-${ROOT}/deploy/sunrey-sandbox-hetzner/docker-compose.yml}"
ENV_FILE="${SUNREY_SANDBOX_ENV_FILE:-${ROOT}/deploy/sunrey-sandbox-hetzner/.env}"
BACKUP_DIR="${SUNREY_SANDBOX_BACKUP_DIR:-${ROOT}/backups/sandbox-postgres}"
RETENTION_DAYS="${SUNREY_SANDBOX_BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"
OUT="${BACKUP_DIR}/sunrey-sandbox-pg-${STAMP}.sql.gz"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dumpall -U "${SUNREY_PG_BOOTSTRAP_USER}" | gzip >"$OUT"

find "$BACKUP_DIR" -type f -name 'sunrey-sandbox-pg-*.sql.gz' -mtime +"${RETENTION_DAYS}" -delete

echo "backup written: $OUT"
