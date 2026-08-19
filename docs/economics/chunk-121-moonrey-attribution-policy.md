# Chunk 121 — Governed MoonRey Cross-Domain Attribution Policy Engine

Canonical owner remains `packages/sunrey-chain`.

Capability `moonrey-policy-governance` is `IMPLEMENTED` and is extended
in place. This chunk does **not** create a second policy registry, a
Productive Value Function, or a MoonRey mint path.

TypeScript policy plane:
`packages/sunrey-chain/src/productive/policy-governance/attribution/`

Governance remains `MoonReyPolicyRegistry`.

Chunk 120 identifies underlying productive economic events. Chunk 121
decides how multiple valid claims attached to the same or related
events may receive economic attribution shares.

## What this is

A versioned simulation policy that assigns **attribution shares** and
an eligibility basis.

Scale: `1_000_000 = 100%`. Shares are `bigint`. Invalid shares are
rejected. They are never silently normalized.

For one underlying economic event, the sum of attribution shares must
not exceed the policy maximum (normally `1_000_000` unless a different
model is explicitly documented).

## What this is not

- Not the Productive Value Function
- Not final economic value
- Not MoonRey issuance
- Not a live production policy
- Not a second `MoonReyPolicyRegistry`

`ATTRIBUTION_DOES_NOT_MINT=true`  
`ATTRIBUTION_DOES_NOT_VALUE_ASSET=true`  
`productionActivated=false`  
`parameterClass=ENGINEERING_SIMULATION_PARAMETERS`

## Constitution

- `SAME_UNDERLYING_EVENT_CANNOT_RECEIVE_MULTIPLE_FULL_CREDITS=true`
- `DISTINCT_REALIZED_SERVICE_MAY_RECEIVE_SEPARATE_ATTRIBUTION=true`
- `CAPACITY_IS_NOT_OUTPUT=true`
- `OUTPUT_IS_NOT_DELIVERY=true`
- `DELIVERY_IS_NOT_AUTOMATICALLY_NEW_PRODUCTION=true`
- `GOODS_IDENTITY_IS_NOT_AUTOMATICALLY_NEW_OUTPUT=true`
- `MACHINE_ACTIVITY_IS_NOT_AUTOMATICALLY_NEW_OUTPUT=true`

## Allocation compatibility

Chunk 74 already defines `CrossCategoryAllocationRule` and
`CapacityOutputAllocationRule`. Those types remain the eligibility
compatibility surface. Attribution policy is the stronger versioned
layer and can compile into those rules. Historical bundles without
attribution still evaluate.

v1 simulation behavior (not a permanent economic policy):

- Manufacturing + machine output on the same event: manufacturing is
  primary; machine-output is lineage/evidence only
- Manufacturing + goods identity: goods does not mint a second output
- Independent logistics (verified tonne-km or delivery completion)
  may be a separate realized service
- Independent storage (volume-time / facility use / realized period)
  may be a separate realized service
- Compute + AI compute on one GPU execution: not two full credits
- Energy production remains the producer's event; factory consumption
  is lineage
- Controller identity does not collapse distinct events and does not
  authorize relabeling one event across categories

v2 may apply a governed split. Historical v1 remains reproducible.

## Governance

AI may propose attribution-policy changes. AI cannot activate them.
Human/protocol governance remains authoritative. There is no live
production attribution policy.

## Review

`REVIEW_REQUIRED` is returned when the relationship is ambiguous,
lineage is incomplete, batch identity is ambiguous, measurement
semantics overlap without a rule, different controllers claim the
same physical output, category hopping is suspected, or
independent-service evidence is insufficient. The engine does not
guess.

## Demo

`npm run demo:moonrey-attribution-policy`
