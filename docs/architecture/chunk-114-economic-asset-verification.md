# Chunk 114 — Economic Asset Rights, Provenance & Verification Policy

Canonical owner: `packages/economic-asset-registry`.

Capabilities:

- `sunrey-economic-asset-registry` remains the singular metadata
  registry owner
- `sunrey-economic-asset-verification` names the rights/provenance
  verification layer on that same owner

See [`docs/economics/chunk-114-economic-asset-verification.md`](../economics/chunk-114-economic-asset-verification.md).

## Authority rule

Verification records that a registry descriptor passed a versioned
policy. It does not store raw datasets, infer legal ownership, value
an asset, mint SunRey or MoonRey, or issue Execution Authority.

## What it implements

- `EconomicAssetVerificationPolicy`
- `EconomicAssetVerificationEngine`
- `EconomicAssetVerificationDecision`
- Registry `evaluateVerification` / `applyVerificationDecision`
- `register({ status: "VERIFIED" })` routed through the verifier

## What it does not do

- Redesign Chunk 113
- Create a competing verification or rights package
- Activate production or claim counsel approval
- Authorize valuation, settlement, minting, or Execution Authority
