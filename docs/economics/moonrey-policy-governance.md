# MoonRey policy governance

`MoonReyPolicyRegistry` stores versioned policy bundles. A bundle
covers eligible categories, normalization rules, factors, caps, epochs,
reference-fact requirements, and eligibility rules.

## Activation

Changes activate at a deterministic height/epoch. Issuance receipts
record the policy version actually used. Historical calculation is
reproducible from contribution + source facts + policy version.

## Actors

- Protocol/human governance may activate a bundle.
- AI may analyze, propose, and simulate.
- AI cannot create a VerifiedEconomicFact, approve a contribution,
  authorize issuance, change a normalization factor, or activate policy.

## Attribution (Chunk 121)

`ProductiveAttributionPolicy` lives under the same registry. It
assigns eligibility shares for claims bound to the same or related
economic events. It does not mint MoonRey and does not perform final
valuation. Historical issuance bundles remain valid without an
attribution field. AI may propose attribution policy and cannot
activate it.

## Oracle reference factors

If a policy uses an economic reference fact, that fact must be a
canonical VerifiedEconomicFact. Consensus cannot retrieve external
prices. Missing, stale, or conflicted reference facts fail closed.

## Corrections

`IssuanceCorrectionRecord` is explicit evidence. It does not silently
rewrite finalized history and does not debit innocent downstream
holders. Any economic correction uses a separately governed mechanism.
