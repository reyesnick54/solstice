# Chunk 100 — SunRey Human Information Network

Production-candidate interfaces for purpose-limited economic rights
in a person's information.

Canonical owner: `packages/information-market` at
`packages/information-market/src/network`.

Capability `sunrey-human-information-network` is `IMPLEMENTED`.

This chunk extends Chunk 27 (`information-market`), canonical Consent,
Privacy Clean Room, Personal Data Vault, and the Exchange
`HUMAN_INFORMATION_RIGHT` family. It does not create a second identity,
consent, vault, clean-room, market, wallet, Exchange, chain, or ledger.

## Product principle

A person controls permissions and economic rights associated with their
information. Sensitive source data remains off-chain. The chain may
anchor permission identifiers, consent hashes, purpose hashes, right
state, usage-receipt hashes, settlement references, and revocation
references.

## No human-worth score

The network does not create social credit, human-quality ranking,
person-worth ranking, or citizen scoring. Economic calculation applies
to governed information rights and transactions only.

## Surfaces

- `HumanInformationNetworkEngine`
- `sunrey-information` CLI
- SDK `InformationClient` and in-process `createInformationApi`
- User control-center and requester-portal projections
- Privacy-minimized mobile notifications

## Hard boundaries

- Raw PDV content is never a market delivery (`NO_RAW_EXPORT`).
- Consent is permission for a governed use, not ownership transfer.
- Generic "any future purpose" access is rejected.
- Revocation blocks future use and does not erase historical settlement.
- A developer API key is insufficient without application approval,
  purpose, consent/right, privacy policy, and eligibility.
- Generic financial-agent mandates are insufficient.
- Human Information activity cannot mint unrestricted SunRey.
- Engineering completion does not activate production.

Do not create `packages/human-information-network`,
`packages/information-market-v2`, `packages/human-information-v2`,
`packages/data-marketplace`, or `packages/sunrey-information-network`.
