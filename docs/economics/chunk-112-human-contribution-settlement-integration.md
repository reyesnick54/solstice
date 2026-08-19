# Chunk 112 — Human Contribution Valuation → Settlement Authorization

Canonical owners:

- Valuation result types and engineering simulation engine:
  `packages/human-economic-contribution/src/valuation`
- Settlement conversion, authorization, and monetary bridge:
  `packages/sunrey-chain/src/economics/human-contribution-bridge`

Capability `sunrey-human-contribution-monetary-bridge` remains the
singular monetary-bridge capability. Chunk 71
`MonetaryIssuanceAuthority` remains the **only** canonical native
monetary issuance authority. This chunk does not create a second mint.

## Authority path

```
Human contribution
  → Chunk 109 / registry verification (VERIFIED)
  → Chunk 111 engineering valuation (reference settlement value)
  → simulation conversion policy
  → settlement authorization
  → privacy-safe HumanEconomicEvidence
  → existing Chunk 71 MonetaryIssuanceAuthority
  → native AssetSupplyBook
```

A valuation result cannot mint. A verified contribution cannot mint.
Only a matching settlement authorization plus the existing monetary
authority can issue simulation SunRey.

## Versioned valuation paths

| Path | Meaning | Production |
| --- | --- | --- |
| `LEGACY_DEVELOPMENT_FIXTURE` | Chunk 108 explicit fixture quantity | unavailable |
| `ENGINE_VALUATION_SIMULATION` | Engineering-implemented reference valuation + conversion | unavailable |
| `PRODUCTION` | Unconfigured / not activated | refused |

`VALUATION_ENGINE_IMPLEMENTED` remains `false`. That constant is the
production boolean and is not flipped. Engineering availability is
`VALUATION_ENGINE_ENGINEERING_IMPLEMENTED = true` with
`VALUATION_ENGINE_PRODUCTION_ACTIVATED = false`.

## Value is not quantity

Contribution reference settlement value is not SunRey Coin quantity.

`1` reference unit is not `1` SunRey by definition.

Simulation conversion uses `SunReyHumanSettlementConversionPolicy`
labeled `ENGINEERING_SIMULATION_PARAMETERS`. Production conversion
remains `UNCONFIGURED`.

## Caps

The most restrictive applicable cap wins:

1. valuation-policy reference ceiling
2. conversion-policy per-contribution ceiling
3. conversion-policy epoch ceiling
4. existing monetary quantity ceiling
5. existing canonical supply controls

No layer may loosen a stricter upstream bound.

## Replay and correction

Replay keys include contribution fingerprint, valuationId,
authorizationId, conversion-policy version, and the settlement event.

A single valuation authorization cannot remint. A revaluation alone
cannot remint. A correction requires an explicit adjustment. Arbitrary
clawback is unavailable.

## Production firewall

- `productionIssuanceActivated=false`
- Production conversion policy: `UNCONFIGURED`
- Production human valuation policy: `UNCONFIGURED` / `NOT_ACTIVATED`
- Production settlement authorization: `UNAVAILABLE`

Maximum supply and genesis parameters are not altered.

## Actors

AI, Financial Agent, S3M, Grok, and model output cannot authorize.
Simulation permits `HUMAN`, `PROTOCOL`, `DEVELOPMENT_FIXTURE`, and
`GOVERNED_PROTOCOL_SIMULATION`.

## Commands

```
npm run demo:sunrey-human-contribution-settlement
```

The demo prints:

```
REFERENCE_SETTLEMENT_VALUE=<value>
SUNREY_SIMULATION_QUANTITY=<quantity>
REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION=false
PEVE_USED_AS_FORMULA=false
AI_AUTHORIZED=false
PRODUCTION_ACTIVATED=false
```
