# Chunk 143 — Production Economic Activation Firewall

The firewall answers one question:

> Is the economic system actually ready to be presented to authorized
> humans for a **future** production activation decision?

It does **not** activate production. There is no `activateProduction()`,
`enableMainnetMoney()`, `turnOnMoonRey()`, or `turnOnSunRey()`.

Canonical owner: `packages/sunrey-chain/src/economics/production-activation`.

Capability: `sunrey-production-economic-activation-firewall`.

## Architecture

```
Engineering Systems
+ External Evidence
+ Human Authorization Requirements
+ Production Economic Parameters
        ↓
Production Economic Activation Firewall
        ↓
ECONOMIC_ACTIVATION_BLOCKED
or ENGINEERING_READY
or AWAITING_EXTERNAL_EVIDENCE
or AWAITING_HUMAN_AUTHORIZATION
or PRODUCTION_CANDIDATE_READY
```

`PRODUCTION_ACTIVE` is not an achievable state in this chunk.
Every decision carries `productionActivated: false`.

## What this consumes

Chunk 143 does not recreate owners:

- Chunk 65 mainnet readiness types and human authorization roles
- Chunk 71 native monetary constitution and `AssetSupplyBook`
- Chunk 78 economic release candidate
- Chunk 84 mainnet release candidate
- Chunk 87 pre-genesis qualification
- Chunk 88 genesis execution
- Chunk 90 production handoff evidence classes
- Chunk 112 SunRey contribution settlement bridge
- Chunks 123–126 MoonRey V2 Productive Value architecture
- Chunk 146 MoonRey production-candidate issuance package metadata
- Chunk 128 provider certification
- Chunk 138 unified economic data fabric
- HIN production gates and chain-anchor engineering requirements

## Domains

Evaluated independently:

| Firewall domain | Existing mainnet `ActivationDomain` |
| --- | --- |
| `SUNREY_COIN_ISSUANCE` | `SUNREY_COIN_NATIVE_ASSET` |
| `MOONREY_COIN_ISSUANCE` | `MOONREY_COIN_NATIVE_ASSET` |
| `HUMAN_INFORMATION_MARKET` | `HUMAN_INFORMATION_MARKET` |
| `PRODUCTIVE_ECONOMIC_DATA` | `PRODUCTIVE_CAPACITY_MARKET` |
| `SUNREY_EXCHANGE_SETTLEMENT` | `SUNREY_EXCHANGE` |

MoonRey readiness does not activate SunRey, and the reverse is also false.
Chain genesis authorization does not activate post-genesis issuance,
Exchange, HIN market, fiat rails, or payments.

## Current repository posture

These facts are unchanged:

- `ENVIRONMENT = simulation`
- every `LIVE_*` flag is `false`
- SunRey / MoonRey production issuance = `UNCONFIGURED`
- maximum supplies = `UNCONFIGURED`
- production economic activation = unavailable

Zero, placeholder, simulation, development, fixture, and rehearsal values
are not production parameters.

## Evidence classes

`ENGINEERING` cannot satisfy a requirement declared `EXTERNAL` or `HUMAN`.
AI, S3M, Grok, agents, automation, and services cannot satisfy human
authorization slots. Fixture evidence (simulation HSM, sandbox provider,
fake contract, fixture signature, rehearsal genesis, testnet faucet,
engineering oracle, synthetic HIN) returns
`FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY`.

HIN chain-anchor engineering readiness does not satisfy privacy counsel
or legal approval. Software booleans record missing/provided state; they
do not claim a real legal review occurred.

## AI boundary

AI may summarize missing evidence, analyze reports, propose remediation,
compare policies, and produce simulation scenarios.

AI may not set production tokenomics, approve maximum supply, approve
genesis allocation, approve monetary issuance, confirm legal or
regulatory approval, or activate production.

## Hashing

`parameterManifestHash` is a domain-separated, ordered encoding of
`PRODUCTION_PARAMETER_IDS`. Changing maximum supply, issuance caps,
conversion rate, value policy, or genesis quantity changes the hash.
Unordered JSON hashing is rejected.

## Constitution

Chunk 71 remains the sole monetary authority. This firewall evaluates
prerequisites. It does not mint, keep a second supply book, or issue
Execution Authority.
