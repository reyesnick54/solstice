# SunRey preproduction deployment guide

This guide deploys the isolated PREPRODUCTION platform. It does not
activate live customer production.

`production_authorized=false`
`ENVIRONMENT=simulation`
`MAINNET_ACTIVE=false`

## What this environment is

PREPRODUCTION is a production-shaped topology:

- Kubernetes workloads for the canonical platform services
- PostgreSQL with TLS, pooling, role separation, and a migrate-first Job
- durable queues (events, jobs, workflows, dead letters)
- private encrypted object storage
- `secret://` references only
- TLS at the public edge
- default-deny network policies
- signed, digest-pinned images

It is bound to SunRey testnet identity
(`net_sunrey_testnet_1` / `chn_sunrey_testnet_1`). Mainnet stays off.
Provider adapters are sandbox, certification, or preproduction only.

## Prerequisites

1. A signed release record
   (`infra/sunrey-production/releases/preproduction-release.json`).
2. Container digest, not a floating tag.
3. Isolated non-production secret backend (or the local rehearsal
   store). Do not use production KMS fixtures.
4. Optional: OpenTofu and Helm if applying to a real cluster.
5. Optional: kind cluster from `deploy/sunrey-preproduction/kind/cluster.yaml`.

## Rehearse without cloud credentials

```
npm run demo:sunrey-preproduction
npm run sunrey-preproduction -- rehearse
```

The rehearsal renders Helm, checks module paths, simulates migrations
from zero and from the prior schema, runs smoke contracts, verifies
the release signature reference, and classifies drift. It does not
mutate cloud resources.

## Apply OpenTofu (when a cloud account exists)

Use `infra/sunrey-production/environments/preproduction.tfvars.json`.
Confirm `production_authorized` is false before plan.

```
tofu plan -var-file=infra/sunrey-production/environments/preproduction.tfvars.json
```

Do not apply the `PRODUCTION` class from CI.

## Apply Helm

```
helm lint infra/sunrey-production/helm/sunrey-preproduction
helm template sunrey-pp infra/sunrey-production/helm/sunrey-preproduction \
  -f infra/sunrey-production/helm/sunrey-preproduction/values.yaml
helm upgrade --install sunrey-pp infra/sunrey-production/helm/sunrey-preproduction \
  --namespace sunrey-preproduction --create-namespace \
  --set image.digest=sha256:<verified-digest>
```

The migrate Job is a `pre-install,pre-upgrade` hook. Incompatible
application rollout must not start until it succeeds.

## TLS and DNS

Public APIs are HTTPS only. Host templates are `api.${dnsZone}`,
`app.${dnsZone}`, `rpc.${dnsZone}`, and `explorer.${dnsZone}`.
`api.sunrey.xyz` is reserved as a future host and is not treated as
confirmed DNS. Rehearsal uses `*.example.invalid`.

## Secrets

Every credential is a `secret://<provider>/<path>` reference. Raw
values must not appear in values files, Terraform variables, or Git.
Production configuration fails closed unless an approved KMS/HSM is
present.

## Rollback

Application: redeploy the previous signed digest. Helm rollback to the
prior release revision is the supported path.

Database: do not assume destructive down-migrations are safe.
Financial schema changes are forward-fix only. Compatible down
migrations may exist for non-financial support tables; they are not
the default.

## Smoke

Against the rehearsal or a live preproduction namespace, confirm:

health, auth, BFF, accounts, payments sandbox, FX sandbox, cards
sandbox, Grow, Agent, Exchange, wallets, Vault, HIN, operations, RPC.

Also confirm `productionAuthorized=false` and `mainnetEnabled=false`
on `/ready`.

## Blockers

- No cloud credentials in this repository CI — rehearsal only.
- Production KMS/HSM is absent — correct for preproduction.
- Final DNS for `sunrey.xyz` is not confirmed.
- Geographic HA is not configured.
