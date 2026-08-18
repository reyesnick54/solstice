# Privacy Clean Room

Canonical owner: `packages/clean-room`.

The Clean Room is a consent-gated computation environment. Requesters
receive only Egress-approved derived results. They cannot browse a
subject's Personal Data Vault, obtain encryption keys, obtain raw
identifiers, run arbitrary SQL, or bypass the Purpose Firewall.

Chunk 100 production-candidate interfaces bind clean-room jobs to
allow-listed computations, output classes, cohort rules, and usage
receipts. See [`../information/privacy-clean-room.md`](../information/privacy-clean-room.md).

## Authorization

Every session requires a verified `ActorContext` with
`CLEAN_ROOM_REQUEST`, a registered simulation requester, an active
purpose, per-subject active consent, a valid `DataUsePermit`, and
matching scope / recipient / operation. Default is DENY.

Possessing a `DataAssetId` is not authorization. Being an internal
SunRey service is not authorization.

## Computation

Only versioned query templates run. Approved operations: COUNT, SUM,
AVERAGE, MIN_MAX_BOUNDED, HISTOGRAM, DISTRIBUTION_BUCKETS,
CATEGORY_AGGREGATION, COHORT_METRIC. Amounts stay integer minor units.

## Privacy controls

Thresholds are labeled `ENGINEERING_POLICY` / `RESEARCH_REQUIRED`.
They are not legally sufficient privacy guarantees.

`DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED` is recorded on every query
budget. This is not a TEE, HSM, or confidential-computing boundary.

## Economic metadata

`ContributionComputationReference` is input data for later SunRey
economic systems. It does not issue SunRey Coin, assign a market
price, assign a monetary value to a human, or create a marketplace
trade.
