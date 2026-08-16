# MoonRey issuance model

MoonRey development units are issued only from policy-eligible
`VerifiedProductiveContribution` records. Arbitrary minting is
refused. Public ticker remains `NOT_ASSIGNED`.

## Eligibility pipeline

1. Register a `ProductiveEconomicObject`
2. Attach valid rights
3. Finalize oracle facts with required quorum and quality
4. Submit a `ProductiveClaim`
5. Verify → `VerifiedProductiveContribution`
6. Anti-double-count via `ContributionFingerprint`
7. Evaluate `MoonReyIssuancePolicy`
8. Issue `MoonReyIssuanceAuthorization`
9. Finalize a native issuance transaction
10. Persist `MoonReyIssuanceReceipt` and reconcile supply

## Formula version

`moonrey.issuance.formula.v1`

```
eligible contribution quantity
× category policy weight
× claim policy factor
× quality factor
= MoonRey eligible quantity
```

All values are integer / fixed-point. Rounding is explicit and
versioned with the policy.

## Policy

`MoonReyIssuancePolicy` is deterministic and height-activated:

- `policy_version`
- `eligible_categories`
- `category_weight`
- `claim_type_weight`
- `quality_multiplier` (fixed-point)
- `maximum_issuance_per_contribution`
- `maximum_issuance_per_category_per_epoch`
- `maximum_total_issuance_per_epoch`
- per-object and per-controller epoch limits
- `minimum_oracle_quorum`
- `required_fact_quality`
- `rounding_mode`
- `activation_height`

Development fixtures are `ENGINEERING_SIMULATION_PARAMETERS`.
They are not market prices or economic promises.

## Receipt

`MoonReyIssuanceReceipt` is immutable: issuance id, recipient,
contribution id, category, input quantity/unit, policy version,
formula inputs, rounding, MoonRey quantity, oracle facts, block
height, and block id. Anyone can reproduce the quantity.

## Replay prevention

One verified contribution may not be used for issuance more than
permitted. The engine persists contribution → issuance mapping.
The same fingerprint is recognized across duplicate submissions.

## Supply reconciliation

`issued − burned = holdings`. Every receipt is included in
`NativeAssetSupplyState.issued`.
