# ADR-0028 — SunRey Blockchain governance and protocol upgrade architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0017, ADR-0021
- Implementation status: NOT_IMPLEMENTED

## Context

Silent protocol upgrades are a supply-chain and governance attack.
AI must not activate mainnet or change blockchain governance.
Legal-review status must not auto-promote.

## Decision

1. Protocol versions are explicit integers (or semver mapped to
   integers) committed in genesis and in every header.
2. Upgrades are **structured**:
   - specify new codec / module / consensus-parameter hashes
   - specify activation height
   - require a human-authorized validator-set or governance
     threshold defined in genesis
   - produce evidence of the decision
3. Upgrade kinds:
   - **Parameter change** (timeouts, max tx size)
   - **Module add/replace** (native handler hash)
   - **Consensus-parameter change**
   - **Hard cutover** (incompatible codec)
4. AI, agents, Growth Orchestrator, and Mesh may propose an upgrade
   artifact. They cannot vote with validator keys, cannot set
   `mainnetEnabled`, cannot change `ENVIRONMENT`, and cannot mark
   counsel status `CONFIRMED_BY_COUNSEL`.
5. A refused or incomplete upgrade leaves the previous version
   authoritative. No silent fallback to a newer binary's state
   machine.
6. There is no production governance token and no ticker for
   voting.

## Alternatives considered

- **Admin key that rewrites state.**
- **Coin-weighted on-chain voting from day one.**
- **Automatic upgrade when a majority of binaries differ.**

## Why rejected

- Admin rewrite is a backdoor ledger.
- Coin voting before legal classification and without a ticker is
  both undefined and a securities-research issue.
- Automatic binary majority is a supply-chain worm.

## Security implications

Malicious upgrades can steal native assets or weaken crypto.
Activation must be height-based so all honest nodes switch
together. Reproducible builds are required to verify module hashes.

## Compliance implications

Governance may itself be a regulated control system.
`RESEARCH_REQUIRED`. Not counsel-confirmed.

## Operability implications

Runbooks: publish artifact, verify hashes, wait for height, halt if
app-hash diverges. Kill-switch for *application* exchange remains
off-chain (`packages/sunrey-exchange`) and does not halt consensus
unless operators halt validators.

## Migration implications

Simulation has no upgrade manager. Adding one later must not enable
mainnet.

## Unresolved questions

- Exact human governance body versus validator threshold.
- Emergency halt procedure versus continued BFT liveness.

## Status

`ACCEPTED_FOR_ENGINEERING` for height-activated, human-gated
upgrades. Production governance: **not implemented**. Legal
confidence: `RESEARCH_REQUIRED`.
