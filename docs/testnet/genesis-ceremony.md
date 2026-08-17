# Genesis ceremony

Each validator operator generates keys locally and contributes **only
public descriptors**.

The ceremony artifact records:

- validator ID
- operator identifier
- consensus public key
- P2P public key
- governance public key
- CryptoSuite
- voting power
- submission hash
- approval metadata

The coordinator never collects validator private keys.

CI uses a seven-validator fixture whose labels include
`NOT_FOR_PRODUCTION`. Fixture secrets are rejected unless
`SUNREY_FIXTURE_ENV` is `local` or `ci`, `CI=true`, or `NODE_ENV=test`.

```bash
node scripts/sunrey-genesis.mjs ceremony
node scripts/sunrey-genesis.mjs genesis
```

Same canonical inputs produce the same genesis hash. JSON presentation
is labeled `JSON_NOT_CONSENSUS` and is not the consensus encoding.
