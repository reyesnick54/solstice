#!/usr/bin/env bash
# Stop the local/simulated PostgreSQL cell.
set -euo pipefail
cd "$(dirname "$0")/.."

if docker compose version >/dev/null 2>&1; then
  docker compose -f infra/postgres/docker-compose.yml down
else
  docker-compose -f infra/postgres/docker-compose.yml down
fi
