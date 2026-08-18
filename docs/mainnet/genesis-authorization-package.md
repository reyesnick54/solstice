# Genesis authorization package

`ProductionGenesisAuthorizationPackage` binds:

- genesis hash
- Mainnet RC
- Candidate V2
- ceremony transcript
- validator set
- human authorization set
- immutable readiness snapshot

Release authority is verified independently and does not equal genesis
authority.

The package never contains private-key material.

Even a complete package does not start production validators, enable
`LIVE_*` flags, or publish mainnet genesis.
