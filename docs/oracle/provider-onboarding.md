# Oracle provider onboarding

`OracleProviderOnboardingRecord` is the operational onboarding record
for a data provider. It is not a legal approval and not an on-chain
consensus object.

## Fields

- provider ID
- legal/entity reference where supplied
- controller reference
- data categories and feeds
- authentication method
- signing key and CryptoSuite
- infrastructure region
- source relationships
- onboarding evidence
- security review status
- commercial agreement evidence reference
- production eligibility
- status

## Status

`DRAFT` → `TECHNICALLY_VALIDATED` → `TESTNET_ACTIVE` →
`PRODUCTION_CANDIDATE`. Operators may `SUSPEND` or `REVOKE`.

Production eligibility requires configured technical, security, and
commercial evidence. A missing contract is never confirmed.

Private keys are never stored on the record. Only public key material
and a signer kind (`SOFTWARE_DEVELOPMENT`, `KMS`, `HSM`) are kept.
Real HSM evidence remains external.

## CLI

```
sunrey-oracle provider onboard
sunrey-oracle provider status
sunrey-oracle provider suspend
```
