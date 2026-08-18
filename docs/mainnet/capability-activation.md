# Capability activation

`ProductionCapabilityActivation` (Chunk 65) tracks each domain separately
with `software_ready`, `security_ready`, `operational_ready`,
`legal_ready`, `regulatory_ready`, `license_or_partner_ready`,
`human_authorized`, `genesis_enabled`, and `runtime_enabled`. Default
production posture is unavailable. A production blockchain does not
automatically authorize Exchange, custody, fiat, payments, cards, or
investments. No capability inherits another capability's legal
authority.

Chunk 89 adds `CapabilityActivationPackage` as the operational
activation path after a future genesis.

`CapabilityActivationPackage` is the only path from rehearsal evidence
to a governed activation decision. Packages are independent. There is no
all-or-nothing production switch.

## Independent capabilities

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

## Binding

Each package binds capability, network, chain, release, active protocol,
required providers, legal/regulatory evidence, security evidence,
operations evidence, human authority, activation coordinate, and
restrictions.

Replay across a different network, chain, release, capability, or policy
version is rejected.

## Authority

Chunk 79 governance operations remain the authority surface. AI can
prepare evidence summaries. AI cannot authorize production activation.

Protocol-native changes activate at a governed height or epoch.
Off-chain services bind activation to an approved chain checkpoint.

## Exchange

Production Exchange eligibility requires market/legal evidence, provider
acceptance, custody readiness, surveillance, compliance, security, and
human authorization. There is no engineering shortcut.

## Custody

Production custody withdrawal eligibility requires a verified production
signer/HSM, provider readiness, policy, security, reconciliation, human
authorization, and external requirements.

## Fiat and payments

Fiat and payment rails require separately accepted external
banking/payment dependencies. Native chain readiness is insufficient.

## Human Information market

Privacy is default-deny. Raw PDV data remains unavailable. Activation
requires consent, purpose, privacy review, legal evidence, Clean Room
readiness, and market authorization.

## Productive capacity and interop

Productive capacity requires a production oracle and productive policy
eligibility. Production interoperability remains separately governed.
There is no simple trusted bridge root.

## Restrictions

Emergency restriction classes from Chunk 79 remain bounded. They cannot
mint, rewrite supply, rewrite finalized blocks, or convert rehearsal
into production.
