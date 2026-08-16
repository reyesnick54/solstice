# ADR-0033 — SunRey Blockchain chain identity, network ID, and genesis

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0017, ADR-0021, ADR-0028
- Implementation status: PARTIAL (simulation IDs exist);
  production genesis: NOT_IMPLEMENTED

## Context

Simulation already defines `chn_sunrey_simulation` and
`net_sunrey_simulation`, plus network modes `SIMULATION`,
`DEVELOPMENT`, `TEST_NETWORK_PLACEHOLDER`, and
`PRODUCTION_DISABLED`. Production must not silently reuse those
IDs or flip a mode to mainnet.

## Decision

1. A network is identified by a tuple:
   `(network_id, chain_id, genesis_hash, protocol_version)`.
2. Genesis is an explicit, hashed configuration:
   - network and chain IDs
   - initial validator set (may be empty in architecture-only)
   - consensus parameters
   - codec and module hashes
   - native asset registry with ticker status `NOT_ASSIGNED`
   - `mainnetEnabled: false`
   - `environment: simulation` for all current artifacts
3. `PRODUCTION_DISABLED` remains the only production-mode token
   allowed in this repository. There is no `MAINNET` mode value
   that can be set true.
4. Simulation IDs must never appear as production genesis IDs.
5. Replay across networks is invalid (ADR-0021).
6. AI cannot emit or activate a genesis with `mainnetEnabled`.
7. No public ticker is placed in genesis.

### Current simulation identifiers (not production)

| Field | Value |
| --- | --- |
| chain id | `chn_sunrey_simulation` |
| network id | `net_sunrey_simulation` |
| adapter | `cad_simulation` |
| mode | `SIMULATION` |

## Alternatives considered

- **One global chain id for all environments.**
- **Auto-generate mainnet genesis when tests pass.**
- **Reuse simulation IDs in production for "continuity."**

## Why rejected

- Shared IDs enable cross-environment replay.
- Auto-genesis is an AI/CI activation path.
- Continuity would launder simulation history into production.

## Security implications

Genesis substitution is a total compromise. Nodes must pin
`genesis_hash`. DNS or config that points at a different genesis
is a different network, not a reorg.

## Compliance implications

Launching a public network may be a regulated offering.
`RESEARCH_REQUIRED`. This ADR does not launch one.

## Operability implications

Operators select a genesis file. Mismatch is a hard stop. There is
no "repair genesis" command.

## Migration implications

A later test-network placeholder needs a new ID tuple. It still
must not set mainnet flags.

## Unresolved questions

- Human ceremony for any future non-simulation genesis.
- How many parallel research networks are allowed.

## Status

`ACCEPTED_FOR_ENGINEERING` for explicit IDs, hashed genesis, and
mainnet-disabled. Production genesis: **not implemented**. Legal
confidence: `RESEARCH_REQUIRED`.
