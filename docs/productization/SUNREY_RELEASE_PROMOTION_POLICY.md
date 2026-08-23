# SunRey release promotion policy

This policy controls how a signed artifact moves toward a future
production deploy. It does not authorize production.

`production_authorized=false`
`FUTURE_PRODUCTION` does not deploy.

## Stages

```
BUILD → TEST → SIGN → STAGING → PREPRODUCTION → HUMAN_APPROVAL → FUTURE_PRODUCTION
```

Stages are sequential. Skipping a stage is a refusal.

| Stage | Meaning | Deploy? |
| --- | --- | --- |
| BUILD | compile, integrity, unit tests | no |
| TEST | package tests and secret scan | no |
| SIGN | digest pin, SBOM/signature verify | no |
| STAGING | production-like topology, sandbox providers | staging cluster only |
| PREPRODUCTION | full isolated platform rehearsal | preproduction only |
| HUMAN_APPROVAL | named humans accept the exact release hash | no |
| FUTURE_PRODUCTION | reserved. Job is disabled (`if: false`) | no |

Automation may promote through PREPRODUCTION. It must not promote into
FUTURE_PRODUCTION. Even with a recorded human approval, the production
job remains disabled while `production_authorized=false`.

## Artifact rules

- Images are referenced by `sha256:` digest. `:latest` and empty tags
  cannot leave TEST.
- The versioned release record must include application version,
  container digest, database migration version, policy versions, Agent
  policy, tool versions, provider config references, and chain config.
- Signature material is a `secret://` reference. Signature bytes are
  not stored in Git.
- Unsigned artifacts cannot enter STAGING or later.

## Environment rules

- `ENVIRONMENT` stays `simulation`.
- Every `LIVE_*` flag stays `false`.
- Mainnet stays inactive. Testnet may be bound.
- Provider adapters are SANDBOX, CERTIFICATION, or PREPRODUCTION.
- Live provider credentials are refused.
- PRODUCTION configuration requires approved KMS/HSM and still does
  not deploy from this policy.

## Database and rollout

Migrations run as a pre-install / pre-upgrade Job. An incompatible
application image must not roll until the Job succeeds.

Application rollback uses the previous signed digest.

Financial schema changes must not assume destructive rollback is safe.
The default database policy is `FORWARD_FIX_ONLY`.

## Drift

The approved plan hash is the source of truth. A manual change that
diverges is `UNAUTHORIZED_DRIFT` and is visible to operators. It is
not auto-applied.

## Workflow

`.github/workflows/sunrey-preproduction.yml` implements the stage
graph for pull requests that touch infrastructure. The main CI
pipeline also runs `npm run demo:sunrey-preproduction`.

Neither workflow applies cloud infrastructure or enables mainnet.
