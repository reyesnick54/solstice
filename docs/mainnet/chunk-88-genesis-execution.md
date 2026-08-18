# Chunk 88 — Authorized production genesis execution

This chunk implements the controlled execution path from an approved
launch dossier to first-finalized-block verification.

Owner: `packages/sunrey-chain/src/genesis-execution`.

Capability `sunrey-production-genesis-execution` is `IMPLEMENTED`.

`realProductionExecutionPerformed=false`. Automated tests use isolated
rehearsal inputs only. This assignment does not run a real production
launch.

## Launch-plan architecture

`ProductionLaunchPlan` binds exact hashes of:

- Mainnet RC (Chunk 84)
- Candidate V2 (Chunk 81)
- `ProductionEnvironmentPlan` (Chunk 86 contract; rehearsal uses an
  isolated stand-in that is unusable in production mode)
- `ProductionGenesisManifest` and genesis bytes (Chunk 85)
- `ProductionGenesisAuthorizationPackage`
- ceremony transcript
- provider readiness (Chunk 82)
- audit/security state (Chunk 83)
- pre-genesis qualification (Chunk 87 contract; rehearsal uses an
  isolated stand-in)
- asset allocation
- required human authorization set
- network ID and chain ID
- the authorized Chunk 85 genesis-time policy value

`ProductionLaunchAuthorization` binds the exact semantic hash of that
plan. Any material change requires a new authorization.

## Authority boundary

Engineering qualification is insufficient. Execution requires a
cryptographically valid authorization package that satisfies configured
production policy. AI cannot occupy a human role.

Required rehearsal/production human roles follow the current
governance/readiness architecture:

- `GENESIS_AUTHORITY`
- `PROTOCOL_AUTHORITY`
- `SECURITY_AUTHORITY`
- `RELEASE_AUTHORITY`

`OPERATIONS_AUTHORITY` is recognized for pre-genesis revocation.

## Execution permit

`LaunchExecutionPermit` is single-use and binds:

- launch-plan hash
- genesis hash
- RC hash
- Candidate V2 hash
- network and chain
- authorization set
- validity window
- unique execution nonce

The same permit cannot create multiple independent genesis executions.
A consumed permit is replay-protected.

## Pre-genesis cancellation

An explicit revocation path exists before genesis is executed.
Revocation requires a human actor. After the first block is finalized,
launch orchestration cannot model rewriting chain history.

## Control room

`LaunchControlRoomState` aggregates authorization, release, Candidate
V2, provider health, validator readiness, signer readiness, network,
storage, database, observability, backup, security findings, external
readiness, genesis status, and first-block status.

Chain genesis is not capability authorization.

## Validator ready check

Each validator independently verifies:

- correct candidate
- correct genesis hash
- correct consensus public key
- correct network and chain
- correct artifact
- remote signer health
- anti-double-sign initialization
- peer/sentry configuration
- time synchronization
- storage health
- operator acknowledgement of the exact genesis hash

## Signer challenge

Before genesis the engine uses a safe challenge domain. It does not
sign future consensus block coordinates.

## Genesis distribution and agreement

Identical canonical genesis bytes/hash are distributed to all validator
operators. Each validator independently verifies the hash. Configured
acknowledgements of that exact hash are required before execution
eligibility.

## Service bring-up

Sequenced: infrastructure, security services, signers, sentries,
validators, consensus, public RPC, Explorer, monitoring.

Independently gated (not brought up by genesis):

- Exchange
- custody withdrawals
- fiat rails
- payments
- cards
- investments
- Human Information markets
- production interop

## First block and supply audit

First proposal records proposer, height, round, block ID, validator-set
hash, and state root. First commit is checked with canonical quorum
rules. Healthy validators must converge on the same app/state root.

Immediate supply audit verifies SunRey quantity, MoonRey quantity,
allocation manifest, and the native supply equation. Hidden allocation
is forbidden. Zero-allocation genesis is a supported approved
configuration. Canonical asset IDs are used. Tickers are not invented.

## Modes

Rehearsal mode uses the identical control-flow shape against a
completely isolated environment
(`net_sunrey_genesis_execution_rehearsal_1` /
`chn_sunrey_genesis_execution_rehearsal_1`, HRP `srger`). CI uses this
mode.

Production mode consumes actual network identifiers, provider evidence,
human signatures, and ceremony artifacts. Known testnet, shadow,
rehearsal, or fixture artifacts are rejected.

## Execution states

`PLAN_CREATED` → `PLAN_VERIFIED` → `AUTHORIZATION_COMPLETE` →
`EXECUTION_PERMIT_ISSUED` → `GENESIS_EXECUTED` →
`FIRST_BLOCK_FINALIZED` → `INITIAL_CHAIN_VERIFIED`

These are not capability-authorization states.

## Formal assurance

Bounded model `GENESIS_EXECUTION_AUTHORIZATION` checks:

- wrong plan cannot execute
- wrong genesis cannot execute
- insufficient human authority cannot execute
- AI cannot authorize
- fixture artifacts cannot execute production
- execution permit cannot be replayed
- first finalized state cannot be rewritten by launch orchestration

## CLI

```
sunrey-launch production plan
sunrey-launch production verify
sunrey-launch production authorization
sunrey-launch production permit
sunrey-launch production readiness
sunrey-launch production control-room
sunrey-launch production execute
sunrey-launch production first-block
sunrey-launch production report
```

CI uses rehearsal flags and environment only.
