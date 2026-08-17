# Interoperability security model

Chunk 50 development security model. This is not a claim of absolute
security, decentralization, or regulatory approval.

## What is trusted

- SunRey remains the authoritative base layer for SunRey economic
  state
- Governed external-chain registration
- Independently verified light-client headers and proofs
- Explicit connections, channels, and packet bindings

## What is not trusted

- Relayers
- User-supplied endpoints
- Foreign finality until verified
- Foreign values as economic truth
- External identity attestations until SunRey policy accepts them
- A multisig "lock and mint" committee

## Post-quantum boundary

SunRey may be hybrid/PQ-capable while an external chain remains
classical. Interop security can never exceed the weakest required
trust domain. `InteropSecurityProfile` exposes:

- foreign finality model
- verified client type
- proof system
- SunRey and foreign crypto classifications
- weakest trust domain
- validator/trust assumptions
- client age and status
- risk classification

`absolute_security_claim` is always false.
`trusted_multisig_bridge` is always false.
`production_ready` is always false.

## Asset boundary

No wrapped fiat. No arbitrary foreign mint. Production SunRey Coin
and MoonRey Coin interoperability stay unavailable until a later
governed activation. `DEV_INTEROP_TEST_ASSET` exists only to prove
escrow / representation / timeout recovery and the conservation
invariant:

`circulating + escrowed + authorized_remote = defined_total`

## DoS bounds

Header, proof, and packet sizes are bounded. Future-height updates
are rejected. Duplicate updates are idempotent. Packet rate is
bounded per height.

## Legal status

`RESEARCH_REQUIRED`. Cross-chain transfers can be money transmission,
Travel Rule events, or sanctions-evasion paths. No record is
`CONFIRMED_BY_COUNSEL`.
