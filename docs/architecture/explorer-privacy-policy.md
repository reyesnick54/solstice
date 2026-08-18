# Explorer privacy policy

`ExplorerExposurePolicy` (`explorer.exposure.v1`) classifies every
field before it leaves the indexer.

## Classes

| Class | Meaning |
| --- | --- |
| `PUBLIC` | Explicitly allowed on the public explorer |
| `PUBLIC_DERIVED` | Safe aggregate computed from public fields |
| `AUTHENTICATED_ONLY` | Not served by the public explorer |
| `PRIVATE` | Never served |
| `FORBIDDEN` | Never indexed or served |

Default classification is `FORBIDDEN`. Fields not listed as `PUBLIC`
or `PUBLIC_DERIVED` are stripped.

## Never expose

- Personal Data Vault raw content
- raw Clean Room rows
- private KYC records
- private compliance screening
- private consent details
- private wallet key information
- validator private infrastructure
- machine controller secrets, secret mandates, or security credentials
- private exchange order-account information
- private consumer portfolio, trading profile, favorites, or price alerts
- private investigations
- private wallet device bindings, sessions, recovery requests, recovery evidence, or session tokens

A BlockchainAccount is not a bank account. The account view states
`notABankAccount: true`.

## Search

Search accepts only bounded identifiers (`[A-Za-z0-9_.:-]`, max 128
bytes). SQL and boolean expressions are rejected.

## Network honesty

The UI banner and API `network` field identify `DEVELOPMENT` (or a
future `TESTNET` / production class). A test network must never imply
real-value production. Tickers remain `NOT_ASSIGNED`.
