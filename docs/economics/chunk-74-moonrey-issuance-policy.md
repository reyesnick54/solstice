# Chunk 74 — MoonRey productive-economy issuance policy

Implemented on latest `main` after Chunk 70. Chunks 71 and 73 were not
present as separate merged declarations on this tip. This chunk extends
the existing MoonRey issuance authority chain (Chunks 43, 44, 45, 61, 68)
and does **not** create a second MoonRey asset or mint path.

Canonical owner remains `packages/sunrey-chain`.

- TypeScript policy plane: `packages/sunrey-chain/src/productive/policy-governance/`
- Formal model: `MOONREY_POLICY_GOVERNANCE`
- CLI: `sunrey-economics moonrey …`

Canonical asset ID: `MOONREY_COIN`.  
Public ticker: `NOT_ASSIGNED`.

## Issuance path

The canonical path is unchanged:

Oracle observations
→ VerifiedEconomicFact
→ ProductiveEconomicObject / contribution
→ VerifiedProductiveContribution
→ eligibility
→ MoonRey issuance authorization
→ native MoonRey issuance
→ receipt

There is no shorter mint path. Arbitrary admin mint remains unavailable.

## What this chunk adds

- Governed `MoonReyIssuancePolicy` bundle and `MoonReyPolicyRegistry`
- `ProductiveCategoryPolicy` over the existing Chunk 44 taxonomy
- Deterministic `ProductiveNormalizationRule` → `NormalizedProductiveUnit`
- `ContributionEligibilityPolicy` and `IssuanceBudgetPolicy`
- Strengthened anti-double-count fingerprints
- Cross-category and capacity/output allocation rules
- Deterministic height/epoch semantics
- `MoonReyPolicyImpactSimulator` and `MoonReySupplyPressureReport`
- `MoonReyIssuanceAudit` and explicit `IssuanceCorrectionRecord`
- Explorer provenance, SDK read APIs, launch-rehearsal exercise

Development parameters remain `ENGINEERING_SIMULATION_PARAMETERS`.
Production caps remain `UNCONFIGURED`.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
