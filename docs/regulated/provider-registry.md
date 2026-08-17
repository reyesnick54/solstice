# Regulated service provider registry

`RegulatedServiceProvider` records a provider-neutral dependency.

## Fields

- provider ID
- service class
- jurisdiction
- endpoint/config reference
- credential reference (`secret://…` only)
- contract, license/registration, security-review, and
  data-processing/privacy evidence slots
- supported capabilities
- environment
- health
- activation eligibility

## Service classes

- `IDENTITY_KYC`
- `SANCTIONS_PEP`
- `AML_TRANSACTION_MONITORING`
- `FRAUD_RISK`
- `TRAVEL_RULE`
- `CUSTODY_HSM`
- `QUALIFIED_CUSTODY_REFERENCE`
- `MARKET_SURVEILLANCE`
- `CASE_MANAGEMENT`
- `FIAT_BANKING_REFERENCE`

No provider is marked qualified or approved without actual evidence.
Missing evidence remains `MISSING` or
`EXTERNAL_VERIFICATION_REQUIRED`.

## Authentication

Provider authentication uses the existing secret/workload-identity
framework:

- mTLS certificate reference
- OAuth/client-credential reference
- signed webhook
- API credential reference

Credentials are never stored in source. Logs redact secret material.

## Outage

If a required provider is unavailable, policy decides whether the
affected regulated action remains unavailable. There is no silent
bypass.
