# SunRey Hetzner Sandbox Deployment

**Baseline:** SunRey Simulation RC2 (`sunrey-backend-v1.0.0-rc.2`)  
**Environment:** `simulation` only — not live regulated production  
**Public API:** `https://api.sunrey.xyz` → Consumer BFF  
**Public frontend origin (CORS):** `https://app.sunrey.xyz`

This guide is written for an operator deploying on a clean Hetzner Cloud Ubuntu server. No developer tooling is required beyond Docker, Git, and a text editor for secrets.

---

## 1. Server prerequisites

| Requirement | Minimum |
|-------------|---------|
| OS | Ubuntu 22.04 or 24.04 LTS |
| CPU | 4 vCPU |
| Memory | 8 GiB RAM |
| Disk | 50 GiB SSD (PostgreSQL + logs) |
| Software | Docker Engine 24+, Docker Compose v2, Git |
| Access | SSH with sudo, outbound HTTPS for image pulls |

Create a dedicated system user (for example `sunrey`) to run the stack. Do not run containers as root inside the images — the provided Dockerfile uses UID `65532`.

---

## 2. DNS

Point these records at your Hetzner server (or Cloudflare proxy in front of it):

| Name | Type | Target |
|------|------|--------|
| `api.sunrey.xyz` | A / AAAA | Hetzner server public IP |

`app.sunrey.xyz` is the **frontend** hosted separately (for example Lovable). It does not need to run on this server, but the API must allow it in CORS.

---

## 3. Cloudflare

Recommended edge setup:

1. Proxy `api.sunrey.xyz` through Cloudflare (orange cloud).
2. SSL/TLS mode: **Full (strict)** with an origin certificate on the server, **or** **Flexible** only for initial smoke tests (not recommended long term).
3. Enable **WebSockets** if your frontend uses them.
4. Restrict origin access with Cloudflare IP allowlists or a Cloudflare Tunnel if you do not expose port 443 publicly.

The Docker stack listens on `127.0.0.1:8443`. Terminate public HTTPS on the host (see section 10) or forward from Cloudflare Tunnel to that port.

---

## 4. Firewall

On the Hetzner server (UFW example):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Do not** open PostgreSQL (`5432`) to the public internet. The compose file keeps PostgreSQL on an internal Docker network only.

---

## 5. Clone and checkout RC2

```bash
sudo mkdir -p /opt/sunrey
sudo chown "$USER":"$USER" /opt/sunrey
cd /opt/sunrey
git clone <your-sunrey-repository-url> .
git fetch --tags
git checkout sunrey-backend-v1.0.0-rc.2
```

Use the RC2 tag recorded in `docs/productization/sunrey-backend-release-candidate.json` if the tag name differs.

---

## 6. Environment setup

```bash
cd /opt/sunrey/deploy/sunrey-sandbox-hetzner
cp ../../infra/sandbox/env.production-sandbox.example .env
```

Edit `.env` and replace every `REPLACE_*` placeholder:

- Strong unique PostgreSQL passwords for each role
- Preview login email and password (minimum 12 characters for password)
- Keep `ENVIRONMENT=simulation` and all `LIVE_*` / `PRODUCTION_*` flags `false`

Never commit `.env`. Restrict permissions:

```bash
chmod 600 .env
```

---

## 7. Database

The stack includes PostgreSQL 16 with a named volume `sunrey_sandbox_pg_data`.

Bootstrap roles and bounded-domain databases:

```bash
docker compose --profile migrate run --rm db-bootstrap
```

Apply schema migrations:

```bash
docker compose --profile migrate run --rm db-migrate
```

PostgreSQL is reachable only as hostname `postgres` inside the Docker internal network.

---

## 8. Migrations

Re-run after upgrades:

```bash
cd /opt/sunrey/deploy/sunrey-sandbox-hetzner
docker compose --profile migrate run --rm db-migrate
```

Migration scripts live in `db/` and are executed by `scripts/postgres-migrate.mjs`.

---

## 9. Backend startup

```bash
cd /opt/sunrey/deploy/sunrey-sandbox-hetzner
docker compose up -d --build
docker compose ps
```

Services:

| Service | Role |
|---------|------|
| `postgres` | PostgreSQL 16 (internal) |
| `consumer-bff` | SunRey Consumer BFF (`services/api/src/preview-main.ts`) |
| `reverse-proxy` | Nginx → Consumer BFF on `127.0.0.1:8443` |

Optional observability profile:

```bash
docker compose --profile observability up -d prometheus
```

Chain simulation runs in-process inside the BFF. No separate chain node is required for this sandbox.

---

## 10. Reverse proxy / TLS on the host

The compose Nginx container binds `127.0.0.1:8443`. Add host-level TLS termination.

**Caddy example** (`/etc/caddy/Caddyfile`):

```caddy
api.sunrey.xyz {
    reverse_proxy 127.0.0.1:8443
}
```

**Nginx example** (origin certificate from Cloudflare):

```nginx
server {
    listen 443 ssl http2;
    server_name api.sunrey.xyz;
    ssl_certificate     /etc/ssl/cloudflare/api.sunrey.xyz.pem;
    ssl_certificate_key /etc/ssl/cloudflare/api.sunrey.xyz.key;
    location / {
        proxy_pass http://127.0.0.1:8443;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Reload the host proxy after changes.

---

## 11. Verification

From the repository root (with `.env` values exported or sourced for preview credentials):

```bash
export SUNREY_VERIFY_API_BASE=https://api.sunrey.xyz
export SUNREY_VERIFY_PREVIEW_EMAIL="<your preview email>"
export SUNREY_VERIFY_PREVIEW_PASSWORD="<your preview password>"
./scripts/verify-sandbox-deployment.sh
```

The script checks:

- API reachability
- `/health` and `/ready` (including database readiness when persistence is required)
- Simulation posture (`productionActive: false`)
- Preview auth session
- Authenticated home, wallet, market, vault, and grow endpoints

Secrets are never printed.

---

## 12. Updates

```bash
cd /opt/sunrey
git fetch
git checkout <new-tag-or-commit>
cd deploy/sunrey-sandbox-hetzner
docker compose --profile migrate run --rm db-migrate
docker compose up -d --build
./scripts/verify-sandbox-deployment.sh
```

---

## 13. Rollback

1. Check out the previous known-good Git tag.
2. Rebuild and restart: `docker compose up -d --build`
3. If migrations are backward-incompatible, restore PostgreSQL from backup (section 14) instead of downgrading schema in place.
4. Re-run `./scripts/verify-sandbox-deployment.sh`

---

## 14. Backup and recovery

### Daily backup

Add a cron job (example: 02:15 UTC daily):

```cron
15 2 * * * /opt/sunrey/scripts/sandbox-pg-backup.sh >> /var/log/sunrey-pg-backup.log 2>&1
```

Defaults:

- Output directory: `backups/sandbox-postgres/`
- Retention: 14 days (`SUNREY_SANDBOX_BACKUP_RETENTION_DAYS`)

### Restore

```bash
./scripts/sandbox-pg-restore.sh backups/sandbox-postgres/sunrey-sandbox-pg-<timestamp>.sql.gz
```

### Restore test (monthly recommended)

1. Restore to a staging volume or temporary server.
2. Run `verify-sandbox-deployment.sh` against the restored instance.
3. Record the result in your operations log.

This is sandbox reliability guidance — not a claimed production RPO/RTO.

---

## 15. Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `/ready` returns 503 | PostgreSQL down or migrations not applied | `docker compose ps`, run migrate profile, check `postgres` logs |
| CORS 403 from browser | Wrong `SUNREY_API_ALLOWED_ORIGINS` | Ensure only `https://app.sunrey.xyz` (no wildcard) |
| Preview login fails | Missing/short `SUNREY_PREVIEW_AUTH_PASSWORD` | Password must be ≥12 characters |
| 502 from edge | Host proxy cannot reach `127.0.0.1:8443` | `docker compose ps`, check `reverse-proxy` and `consumer-bff` |
| Container restart loop | Invalid env | `docker compose logs consumer-bff` |

Logs:

```bash
docker compose logs -f consumer-bff
docker compose logs -f postgres
docker compose logs -f reverse-proxy
```

Readiness requires persistence when `SUNREY_FEATURE_REQUIRE_PERSISTENCE_FOR_READY=true`. There is no silent in-memory fallback for this deployment tier.

---

## Related documents

- `docs/runbooks/SUNREY_SANDBOX_DEPLOYMENT.md` — local integrated sandbox
- `docs/architecture/WAVE8_OPERATIONS_AND_SANDBOX_DEPLOYMENT.md` — architecture reference
- `deploy/sunrey-sandbox-hetzner/docker-compose.yml` — canonical Hetzner stack
- `infra/sandbox/env.production-sandbox.example` — environment template
