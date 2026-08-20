# CHUNK-159 — Main-branch integrity lock

Capability `sunrey-repository-integrity` is `IMPLEMENTED` on the
existing architecture-linting owner `tools/architectural-linter`.
Companion scripts remain under `scripts/`.

This chunk is repository integrity infrastructure. It is not a new
business subsystem, not a second architecture authority, and not a
mutating merge manager.

## What landed on `main` before this chunk

Post-merge collisions left:

- four `package.json` `"test"` script keys
- three capability records concatenated into one
  `docs/architecture/manifest.json` object
  (`sunrey-unified-control-room`,
  `sunrey-distributed-idempotency-recovery`,
  `sunrey-operational-persistence-recovery`)
- a leftover `AGENTS.md` persistence layout bullet
- duplicate documentation status rows, including a stale
  `sunrey-hin-chain-anchoring` `PARTIAL` row

JSON.parse keeps the last duplicate key. That is why the damage was
silent.

## Repair rule

The surviving `scripts.test` command is the **superset** of the
intended current test locations, including:

- `packages/security/src/regulated/`
- nested `packages/payments/src/`
- nested `packages/persistence/src/`
- nested `packages/sunrey-chain/src/release-candidate/economic/`

Do not keep the last colliding key. Do not drop a newer nested suite
because an older branch still listed `*.test.ts` only.

Capability records keep their existing canonical owners. This chunk
does not create `packages/repository-integrity`,
`packages/architecture-v2`, or `packages/merge-manager`.

## Commands

```
npm run integrity:check
npm run integrity:report
```

`integrity:report` prints:

```
JSON_INTEGRITY=true
MERGE_MARKERS_PRESENT=false
PACKAGE_TEST_KEY_COUNT=1
ARCHITECTURE_CAPABILITY_IDS_UNIQUE=true
ARCHITECTURE_COMPONENT_IDS_UNIQUE=true
CHUNK_IDS_UNIQUE=true
CANONICAL_OWNER_COLLISIONS=0
LIVE_FLAGS_CHANGED=false
```

## Policy

See [`merge-integrity-policy.md`](./merge-integrity-policy.md).

Architecture-affecting chunks merge one at a time. PR branches that
touch `package.json`, `manifest.json`, `AGENTS.md`, CI workflows, or
`chunk-dependencies.md` must update from latest `main` before final
merge.

## Baseline

[`integrity-baseline.json`](./integrity-baseline.json) records safe
structural counts. It is not architecture authority.
`manifest.json` remains authority. Counts must not drop without an
explicit repair.

## What this does not do

- It does not change Kernel, ledger, Evidence Vault, or Execution
  Authority owners.
- It does not flip `ENVIRONMENT` or any `LIVE_*` flag.
- It does not invent a competing architecture package.
- It does not auto-merge conflicting owners.
