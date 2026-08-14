#!/usr/bin/env bash
# Start the local/simulated PostgreSQL cell.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to start the local PostgreSQL environment" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  docker compose -f infra/postgres/docker-compose.yml up -d --wait
else
  docker-compose -f infra/postgres/docker-compose.yml up -d
fi

echo "PostgreSQL is up on 127.0.0.1:5432 (local/simulated credentials only)."
echo "Next: npm run db:migrate"
