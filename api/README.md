# SunRey public API specifications

Canonical machine-readable definitions for the developer platform.

- `sunrey-chain-v1.openapi.yaml` — chain, accounts, assets, fees, validators, governance, oracles, productive economy, machine economy, interoperability, transactions, events
- `sunrey-exchange-v1.openapi.yaml` — SunRey Exchange v1
- `sunrey-events-v1.md` — versioned event subscriptions and resume
- `sunrey-developer-platform-v1.openapi.yaml` — application registry, credentials, webhooks, sandbox, usage
- `sunrey-webhooks-v1.json` — versioned webhook event and signing schema
- `sunrey-sdk-vectors-v1.json` — cross-language identifiers
- `sunrey-consumer-bff-v1.openapi.yaml` — Consumer BFF / Lovable orchestration API (`/api/v1`). Not the chain `/v1` gateway.

Public API version: **v1**

Compatibility classes: `BACKWARD_COMPATIBLE`, `DEPRECATED`, `BREAKING_CHANGE`.

A protocol upgrade does not automatically imply an API breaking change.
