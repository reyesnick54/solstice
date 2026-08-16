# Compute and intelligence markets

Compute markets reuse Chunk 45 machine-economy identity, capabilities,
and `UnitRegistry`. They do not create a second machine exchange.

## Example instrument

`AI_COMPUTE_GPU_SECOND`

- provider
- region
- hardware/service class (`GPU_COMPUTE`, `CPU_COMPUTE`,
  `AI_INFERENCE`, `STORAGE`, `BANDWIDTH`,
  `SPECIALIZED_MODEL_EXECUTION`)
- capacity
- delivery window
- unit (`GPU_SECOND`, `INFERENCE_UNIT`, …)
- optional maximum latency class
- oracle/metering policy
- settlement asset

## Matching

Machines may buy or sell only with an explicit capability
(`PURCHASE_COMPUTE`, `SELL_COMPUTE`, …). Capability is not inferred
from a prompt.

Two-stage matching still applies. A machine without the capability
cannot match even at a crossing price.

## Settlement

Template `COMPUTE_SPOT_V1`:

1. Lock settlement-asset escrow for `ordered * unit_price`.
2. Accept a `VerifiedEconomicFact` (for example GPU-seconds consumed).
3. Conflicted or stale facts block ordinary settlement.
4. Pay `delivered * unit_price` exactly. Release unused escrow when
   policy is `PAY_VERIFIED_RELEASE_UNUSED`.

Example: 300 GPU-seconds ordered, 270 delivered, unit price 2 → pay
540, release 60.

## Market data

Unit price, available capacity, delivery windows. No blended yield.
