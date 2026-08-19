# Chunk 107 — HIN to Human Contribution Registry

Canonical owner: `packages/information-market` at
`packages/information-market/src/network/contribution`.

Capability `sunrey-hin-contribution-integration` is `IMPLEMENTED`.

This chunk extends Chunk 100. It does not create a second Human
Information Network, consent ledger, clean room, PEVE engine, or
monetary authority.

See
[`docs/economics/chunk-107-hin-contribution-integration.md`](../economics/chunk-107-hin-contribution-integration.md).

## Authority rule

HIN records information rights and realized authorized use. The
Human Contribution Registry records verified economic contributions.
PEVE measures a personal economic system. Chunk 71 issues money.

Consented information use can become a verified
`INFORMATION_RIGHT_CONTRIBUTION`. It cannot automatically mint
SunRey.

## What it implements

- `HinContributionAdapter`
- `HumanContributionRegistryPort`
- Privacy-safe `InformationRightContributionEvidence`
- Fail-closed rights / purpose / consent invariants
- Authorized internal contribution-ID projection
- Optional PEG `DATA_ASSET.contributionId` linkage
- `demo:sunrey-human-information-contribution`

## What it does not do

- Reimplement the Human Information Network
- Create another consent or clean-room system
- Store raw personal information on the registry
- Convert HIN compensation into SunRey issuance
- Force non-information contribution classes through HIN
- Enable `productionActivated` or live data monetization
