# Chunk 40 — SunRey protocol governance and upgrade manager

Implemented on latest `main` after Chunks 36R–39. Validator registry,
integer voting power, BFT consensus, and simulation accountability
are already `IMPLEMENTED` on `packages/sunrey-chain`. This chunk does
not reimplement those planes. Development governance identities use
distinct `GOVERNANCE_KEY` descriptors and must not reuse consensus,
P2P, or Execution Authority keys.

Canonical owner remains `packages/sunrey-chain`.

- TypeScript engine: `packages/sunrey-chain/src/governance/`
- Local-node manager: `packages/sunrey-chain/rust/crates/governance`
- CLI: `sunrey-node governance …` and `sunrey-node protocol version`

Do not create `packages/governance` or `packages/sunrey-governance`.

## Core principle

Running a newer binary does not change consensus rules. Protocol state
changes only when an authorized `UpgradePlan` becomes active at a
defined height from finalized chain state, not from local clocks.

There is no governance token. SunRey Coin does not grant voting power.
MoonRey does not grant voting power.

## Governance policy

Development genesis uses `VALIDATOR_SUPERMAJORITY` with integer voting
power: four `VALIDATOR_GOVERNANCE_SIGNER` identities, power `1` each,
required power `3`. Alternate models exist in the type system:

- `VALIDATOR_SUPERMAJORITY`
- `VALIDATOR_SUPERMAJORITY_PLUS_RELEASE_AUTHORITY`
- `SECURITY_EMERGENCY_THRESHOLD`

Roles: `PROTOCOL_OPERATOR`, `VALIDATOR_GOVERNANCE_SIGNER`,
`SECURITY_GOVERNANCE_SIGNER`, `RELEASE_AUTHORITY`. AI may prepare
artifacts. AI cannot approve, vote, change activation height, change
thresholds, change CryptoSuite policy, activate a protocol version,
enable a production network, or change legal-review status.

## Upgrade lifecycle

`DRAFT → PROPOSED → VALIDATING → AWAITING_AUTHORIZATION → AUTHORIZED
→ SCHEDULED → READY → ACTIVATED`

Illegal or refused paths: `REJECTED`, `CANCELLED`,
`FAILED_VALIDATION`, `SUPERSEDED`. No silent transition based on
installed software.

## Height activation

An authorized plan activates exactly at `activation_height`. Headers
from that height commit:

- protocol version
- consensus params hash
- module registry hash
- codec registry hash
- crypto policy hash

An incompatible node reports readiness (`INCOMPATIBLE_BINARY`,
`MISSING_ARTIFACT`, …) before the height and must not produce
divergent state at activation (`INCOMPATIBLE_PROTOCOL`).

## What this chunk does not implement

- Production governance or a public network
- A governance token or coin-weighted voting
- Reimplementation of the Chunk 36R–39 validator, BFT, or
  accountability planes
- MoonRey issuance
- Customer fiat authority changes
- Counsel-confirmed policy (`RESEARCH_REQUIRED`)

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
