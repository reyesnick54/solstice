# Mainnet RC freeze policy

A Mainnet Release Candidate freezes exact inputs. Changing any frozen
input invalidates the signed bundle and requires requalification.

## Source freeze

- Git source commit
- Rust toolchain
- Node toolchain
- npm and Cargo lockfile digests
- Generated protocol sources
- Container images (digest-pinned only; floating tags are rejected)
- SBOM digest
- Provenance digest
- ReleaseAuthority signature

## Protocol freeze

Transaction protocol, block protocol, consensus, validator rules,
execution runtime, state schemas, P2P protocol, governance, and
crypto policy.

## Economic freeze

The candidate binds the Chunk 78 economic RC (or a later verified
superseding economic bundle). Exact policy hashes are recorded for:

- SunRey monetary policy
- MoonRey monetary policy
- FeePolicyV2
- Validator economics
- MoonRey issuance
- Protocol treasury

A modified economic RC is rejected.

## Network candidate freeze

The candidate binds the Production Network Candidate V2 root hash.
Any candidate change requires requalification. Wrong Candidate V2
hashes are rejected.

## Provider, audit, and HSM freeze

Provider acceptance, security-review findings, HSM state, SBOM, and
provenance are part of the signed digest set. Tampering any of them
invalidates verification.
