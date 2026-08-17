# Capability activation matrix

`ProductionCapabilityActivation` tracks each domain separately:

- `SUNREY_CHAIN`
- `SUNREY_COIN_NATIVE_ASSET`
- `MOONREY_COIN_NATIVE_ASSET`
- `SUNREY_EXCHANGE`
- `INSTITUTIONAL_CUSTODY`
- `FIAT_BANKING`
- `PAYMENT_RAILS`
- `CARDS`
- `INVESTMENTS`
- `HUMAN_INFORMATION_MARKET`
- `PRODUCTIVE_CAPACITY_MARKET`
- `INTEROPERABILITY`

Fields: `software_ready`, `security_ready`, `operational_ready`,
`legal_ready`, `regulatory_ready`, `license_or_partner_ready`,
`human_authorized`, `genesis_enabled`, `runtime_enabled`.

Default production posture is unavailable. A production blockchain does
not automatically authorize Exchange, custody, fiat, payments, cards, or
investments. No capability inherits another capability's legal
authority.

Software implementation alone is insufficient for Exchange, custody,
oracle, interop, or privacy production activation.

Structured checklists (`ExchangeReadinessSlot`, `CustodyReadinessSlot`,
`OracleReadinessSlot`, `InteropReadinessSlot`, `PrivacyReadinessSlot`)
keep those sub-requirements explicit. Default items remain
`NOT_PROVIDED` or `EXTERNAL_VERIFICATION_REQUIRED`. No capability
inherits another capability's legal authority.
