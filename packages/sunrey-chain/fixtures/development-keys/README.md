# Development fixture keys

These keys are **local development / simulation fixtures only**.

They are derived from a public label
`SUNREY_LOCAL_DEV_FIXTURE_KEY_NOT_FOR_PRODUCTION_v1` and must never be
used as production validator, transaction, or custody keys.

This directory is not production key infrastructure. A later production
key ceremony must use a separate control plane.

Chunk 36R four-validator development identities are derived from
public labels
`SUNREY_DEV_VALIDATOR_{A,B,C,D}_{CONSENSUS,P2P,GOVERNANCE,RECOVERY}_NOT_FOR_PRODUCTION_v1`.
Private material is never committed. Operator tooling omits private
keys by default.
