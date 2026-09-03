#!/usr/bin/env bash
# Restore a SunRey sandbox PostgreSQL backup produced by sandbox-pg-backup.sh.
# Usage: ./scripts/sandbox-pg-restore.sh /path/to/backup.sql.gz
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${SUNREY_SANDBOX_COMPOSE_FILE:-${ROOT}/deploy/sunrey-sandbox-hetzner/docker-compose.yml}"
ENV_FILE="${SUNREY_SANDBOX_ENV_FILE:-${ROOT}/deploy/sunrey-sandbox-hetzner/.env}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "backup not found: $BACKUP_FILE" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "Stopping consumer services before restore..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop consumer-bff reverse-proxy

gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  psql -U "${SUNREY_PG_BOOTSTRAP_USER}" -d postgres

echo "Restarting services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d consumer-bff reverse-proxy
echo "Restore complete. Run ./scripts/verify-sandbox-deployment.sh to validate."
