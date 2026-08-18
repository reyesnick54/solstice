# Production network manifest (Candidate V2)

`ProductionNetworkManifestV2` is the versioned binding of the
production-network candidate. It is an engineering descriptor.

Bound fields:

- source commit
- release artifact digest
- protocol version and API version
- economic RC id and qualification digest
- CryptoPolicy hash
- validator set candidate hash
- economic policy bundle hash
- governance policy hash
- storage schema hash
- network topology hash
- infrastructure configuration hash
- service manifest hash
- security evidence hash
- readiness evidence hash

The manifest digest is deterministic for identical inputs. Changing a
validator, policy hash, release artifact, network ID, chain ID,
service artifact, HSM state, economic RC, or readiness evidence
changes or invalidates the candidate root hash.

`productionAuthorized` remains `false`.
