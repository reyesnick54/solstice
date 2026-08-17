# Hybrid signature protocol

Combiner: **`CLASSICAL_AND_PQ`**.

Verification policy **`REQUIRE_ALL`** is AND, not OR. Verification
passes only if every required component is valid.

## Envelope

Versioned encoding `srhyb1:<classicalHex>:<pqHex>` plus the structured
`HybridSignatureDescriptor` used by `signHybrid` / `verifyHybrid`.

Bound fields:

- classical algorithm ID
- PQ algorithm ID
- key IDs
- signature components
- CryptoSuite ID
- domain
- network
- chain
- payload hash

Ambiguous or missing components fail closed.

## Downgrade resistance

If policy requires hybrid, a classical-only signature fails.
If policy requires PQ, a classical-only signature fails.
Editing suite identifiers cannot obtain weaker verification.
Crypto validity alone does not imply policy authorization.

## Default testnet pair

Classical: Ed25519 (`sunrey-ed25519-v1`).
PQ: ML-DSA-65 (`ML_DSA_65_V1`) in suite `sunrey-hybrid-ed25519-mldsa-v1`.

SLH-DSA is a diversified option and is not the default validator
algorithm.
