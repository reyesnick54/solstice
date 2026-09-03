# SunRey Hetzner sandbox deployment

Canonical operator guide: [`docs/deployment/SUNREY_HETZNER_SANDBOX_DEPLOYMENT.md`](../../docs/deployment/SUNREY_HETZNER_SANDBOX_DEPLOYMENT.md)

Quick start:

```bash
cp ../../infra/sandbox/env.production-sandbox.example .env
# edit secrets
docker compose up -d --build
docker compose --profile migrate run --rm db-bootstrap
docker compose --profile migrate run --rm db-migrate
../../scripts/verify-sandbox-deployment.sh
```

Stack: PostgreSQL 16 + Consumer BFF + Nginx reverse proxy (simulation only).
