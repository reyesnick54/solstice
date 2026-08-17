# RC freeze policy

A Testnet release candidate freezes protocol, API, cryptography,
dependencies, and artifacts. Any material change creates a new RC id.
The prior candidate becomes `SUPERSEDED`. Historical evidence is
retained.

## Feature inventory

Every protocol/runtime feature is exactly one of:

- `FROZEN_IN_RC`
- `EXCLUDED_FROM_RC`
- `EXPERIMENTAL_TESTNET_ONLY`

There is no ambiguous feature state. Mainnet, production banking
rails, and public staking are `EXCLUDED_FROM_RC`.

## Protocol freeze

Hashed and frozen:

- canonical transaction schema
- block schema
- consensus parameters
- state machine version
- native asset schema
- fee schema
- governance schema
- oracle schema
- productive economy schema
- interop packet schema

A change to any hash requires a new RC.

## API freeze

Public SDK/API v1 is frozen for the candidate. A breaking API change
requires new candidate metadata. A protocol upgrade does not
automatically break the API.

## Crypto policy freeze

The RC records the exact testnet CryptoSuite configuration:

- classical algorithms (Ed25519, SHA-256, AES-256-GCM)
- real standardized PQ provider (`@noble/post-quantum@0.5.4`)
- hybrid requirements
- selected role policies
- legacy verification policy (`historicalVerifyAllowed`; silent downgrade rejected)

This does **not** imply production cryptographic approval.

## Dependency freeze

The RC references exact npm lock digest, Cargo lock digests, container
base digests where available, toolchain versions, the PQC dependency,
and formal-tool presence (Chunk 61 when merged).

## Artifact freeze

Signed candidate artifacts include at minimum:

`sunrey-node`, `sunrey-rpc`, `sunrey-explorer`, `sunrey-faucet`,
`sunrey-relayer`, SDK, Exchange, and custody where deployable.
