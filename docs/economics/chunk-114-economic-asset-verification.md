# Chunk 114 — Economic Asset Rights, Provenance & Verification Policy

This chunk makes **VERIFIED** registry status meaningful.

`VERIFIED` now means:

> the economic-asset descriptor passed a versioned, asset-class-specific
> rights, provenance, storage, lineage, and chain-anchor policy

and not merely:

> a caller asked for `status: "VERIFIED"`.

Canonical owner remains `packages/economic-asset-registry`.

Capability `sunrey-economic-asset-registry` remains the singular
metadata/rights/provenance/lineage/policy registry. Capability
`sunrey-economic-asset-verification` names the verification layer on
that same owner. Do not create `packages/dataset-verification`,
`packages/data-rights-registry`, `packages/economic-provenance`,
`packages/asset-rights`, or `packages/economic-assets-v2`.

Chunk 113 is not redesigned. The registry still describes metadata,
references, and commitments. This chunk adds a deterministic verifier
so promotion to `VERIFIED` requires a successful
`EconomicAssetVerificationDecision`.

## Path

```text
registered EconomicAssetDescriptor
    → rights evaluation
    → provenance evaluation
    → lineage evaluation
    → EconomicAssetVerificationEngine.evaluate
    → EconomicAssetVerificationDecision
    → EconomicAssetRegistry.applyVerificationDecision
    → VERIFIED registry descriptor
```

`register({ status: "VERIFIED" })` cannot bypass policy. It is routed
through the same verifier. A failed decision does not store `VERIFIED`.

## Policy

`EconomicAssetVerificationPolicy` is immutable once activated and
versioned (`policyId` + `policyVersion`).

Engineering policy state is `SIMULATION`. `productionActivated` is
`false`. Counsel approval is not claimed. Production legal approval is
not claimed.

`OTHER_GOVERNED_ECONOMIC_ASSET` fails closed unless an activated
policy explicitly enables it.

Class-specific rules cover Human Information assets, information
rights, human-contribution evidence and records, public reference
data, oracle sources and observations, verified economic facts,
productive objects, claims, contributions, and attestations.

Human-information assets may require consent, purpose, and usage-right
references. Productive and industrial assets may instead require a
commercial license, operating right, or controller authorization.
The human consent model is not forced onto industrial telemetry.
`packages/consent` is not recreated; the registry stores references.

## Rights

Controller, subject, operator, and custodian are not legal owners.
Legal ownership is established only by an explicit
`legalOwnershipRightsRef`. The verifier never infers title.

## Storage and retention

Typical compatibility:

- `SENSITIVE_PERSONAL` → `OFF_CHAIN_PROTECTED`
- `PERSONAL` → `OFF_CHAIN_PROTECTED` or commitment-only metadata
- `RESTRICTED_INDUSTRIAL` → `OFF_CHAIN_RESTRICTED`
- `SECRET_REFERENCE_ONLY` → never a public payload
- `PUBLIC` → public reference or approved public metadata

No sensitive payload is moved on chain. Retention and deletion
metadata apply to source data. Immutable historical commitments and
audit references may remain after a source record is deleted. This
chunk does not delete canonical chain history.

## Lineage and anchors

Lineage must be cycle-safe, parent-explicit where required, and must
not fabricate `VERIFIED_BY` or emit `SETTLED_FROM` without a
settlement reference. Temporal sequence is not economic causality.

`FINALIZED_ON_SIMULATION` requires simulation block/transaction
metadata. `UNANCHORED` must not carry fabricated finalized-block
claims. Protected commitments may be anchored. Protected raw data may
not. This chunk does not create new blockchain transaction types.

## Authority boundary

A verification decision always records:

- `containsRawSensitiveData: false`
- `authorizesValuation: false`
- `authorizesSettlement: false`
- `authorizesSunReyIssuance: false`
- `authorizesMoonReyIssuance: false`
- `authorizesExecution: false`

Registry verification is not valuation, minting, settlement, or
Execution Authority.

## Commands

```
npm run demo:sunrey-economic-asset-verification
```

The demo prints:

```
RAW_DATA_STORED=false
LEGAL_OWNERSHIP_INFERRED=false
VALUATION_AUTHORIZED=false
SUNREY_MINT_AUTHORIZED=false
MOONREY_MINT_AUTHORIZED=false
PRODUCTION_ACTIVE=false
```
