# Production environment plan

`ProductionEnvironmentPlan` is the immutable, hash-addressed description
of a future deployment. Identical approved inputs produce the same
semantic hash.

The plan binds:

- Candidate V2 identity and root hash
- Mainnet RC identity and cryptographic manifest hash
- provider matrix digest
- network ID and chain ID
- topology and service artifact digests
- storage, database, object-storage, and security policy
- workload identities and network policy

It never embeds private keys, secret values, or a developer-local clock.
See `packages/sunrey-chain/src/infra/provisioning/plan.ts`.
