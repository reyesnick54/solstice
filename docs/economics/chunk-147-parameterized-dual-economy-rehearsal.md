# Chunk 147 — Parameterized SunRey + MoonRey Economic Activation Rehearsal

This chunk is **rehearsal only**.

It exercises a complete production-candidate parameter package
without converting any fixture value into real production
configuration.

Canonical owner: `packages/sunrey-chain/src/economic-rehearsal`
(bounded module `parameterized-candidate/`).

Capability: `sunrey-economic-mainnet-rehearsal` (extended; not a
second owner).

## Disclaimer

Every fixture value is explicitly:

- `sourceClass = REHEARSAL_FIXTURE`
- `fixture = true`
- `rehearsalOnly = true`

Documentation states, and the package repeats:

- **NOT RECOMMENDED TOKENOMICS**
- **NOT A PRODUCTION PROPOSAL**
- **NO ECONOMIC MEANING OUTSIDE REHEARSAL**

## Architecture

```
Rehearsal Parameter Package
        ↓
Production Parameter Validators
        ↓
SunRey Candidate Policy
+
MoonRey Candidate Policy
        ↓
Economic Rehearsal
        ↓
Supply / Issuance / Exchange / Stress
        ↓
Reconciliation
        ↓
Chunk 143 Firewall
        ↓
STILL BLOCKED FOR PRODUCTION
```

## Validators

The rehearsal package is fed through the same production validators
that exist on `main`:

- Chunk 143 type classification, dependency completeness, and
  canonical `parameterManifestHash`
- Chunk 112 SunRey conversion validation
- Chunk 125 MoonRey GPUV conversion validation
- Cross-parameter invariants (genesis totals, max ≥ genesis,
  non-identity conversion)

When Chunks 144–146 are present, those owners are detected and used.
This module does not create a simplified rehearsal-only validator.

## Firewall

The package is passed to Chunk 143 before and after the rehearsal.

Expected:

- parameter structure may be complete
- `FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY` remains
- other missing external/human blockers remain
- `PRODUCTION_ACTIVE = false`
- the rehearsal does **not** improve external/human evidence states
  merely because engineering tests pass

The firewall is not modified to make rehearsal green.

## Paths

SunRey (synthetic human data only):

HIN evidence → consent/right → chain anchoring → verified human
contribution → valuation → reference value → rehearsal conversion →
settlement authorization → Chunk 71 DEVELOPMENT/REHEARSAL authority →
`AssetSupplyBook`

MoonRey (governed V2 primary; not legacy V1):

source fixture → connector → certification → oracle → verified fact →
productive contribution → event → attribution → Productive Value →
GPUV → rehearsal conversion → Chunk 71 → `AssetSupplyBook`

Representative categories: ENERGY, COMPUTE, MANUFACTURING,
LOGISTICS_TRANSPORTATION, FOOD_AGRICULTURE, WATER, GOODS, SERVICES.
Unsupported units are not fabricated.

## Dual-coin rules

SunRey and MoonRey supplies are tracked separately. They are never
merged. There is no fixed peg, no guaranteed exchange ratio, and no
protocol guarantee of equal value.

Exchange rehearsal uses the existing Chunk 80 economic-rehearsal
SunRey/MoonRey simulation and the canonical asset IDs `SUNREY_COIN` /
`MOONREY_COIN`. `packages/sunrey-chain` does not import
`packages/sunrey-exchange`. Exchange price changes do not alter
human valuation, GPUV, or conversion.

## Shared event

One rehearsal workflow includes a human contribution and productive
machinery in a related economic flow. Identities, lineage, and
attribution stay explicit. The two assets measure different layers.
There is no automatic double issuance and no forced SunRey/MoonRey
split.

## Stress

The existing Chunk 76 stress owner is extended. Combined scenarios
cover:

- human contribution burst + productive output surge
- oracle outage + MoonRey demand shock
- exchange price volatility + high issuance volume
- provider concentration + controller concentration
- network congestion + settlement backlog
- policy upgrade + reconciliation delay

Controller and category concentration are reported. They are not
legal or antitrust conclusions. Categories are not auto-reweighted
unless a future governed policy says so.

## Governance

Parameter package v1 can be superseded by a rehearsal v2. Historical
receipts keep the original policy reference. New issuance uses the
new version only after rehearsal activation. Conversion changes are
not retroactive. A future max supply below currently issued supply
is rejected and does not burn existing balances.

## Invariants

The rehearsal proves:

- no negative supply
- no max-supply breach
- no duplicate issuance
- no token-price feedback issuance
- no hidden premint
- no unauthorized genesis allocation
- no PEVE→SunRey formula
- no GPUV=MoonRey identity
- no AI production authorization
- no fixture production authorization

## Demo

```
npm run demo:sunrey-parameterized-dual-economy-rehearsal
```
