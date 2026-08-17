# Productive normalization

Different productive categories use different source units. Consensus
never mixes incompatible raw units.

## NormalizedProductiveUnit

`NormalizedProductiveUnit` (`NPU`) is an internal issuance-calculation
quantity. It is not:

- fiat value
- market capitalization
- legal property title
- guaranteed economic value

## Rule

A versioned `ProductiveNormalizationRule` converts an eligible
category-specific contribution into an integer NPU using checked
fixed-point arithmetic (`WEIGHT_SCALE = 1_000_000`).

```
sourceQuantity
  × scaleToNpu
  × unitNormalization
  × quality
  × verifiedDeliveryState
  × economicCategory
  / WEIGHT_SCALE^n
= NPU
```

Rounding is explicit (`FLOOR`, `CEIL`, `ROUND_HALF_EVEN`). No floats.

Source units may include kWh, compute-seconds / GPU-hours, inference
units, manufactured units, storage-byte-time, delivered kilograms,
bandwidth-byte-time, and service units. Each rule binds one category
to one source unit.

## Factors

Every factor is versioned, bounded, and auditable. Out-of-bound or
malformed factors fail closed (`MALFORMED_NORMALIZATION`).
