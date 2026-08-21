# SunRey external provider integration package

This package describes how a selected external vendor is bound behind an
existing SunRey owner. It is not a vendor contract, license, or
production authorization.

`ENVIRONMENT=simulation`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

SunRey continues to own domain logic, Ledger, Kernel, Execution
Authority, Exchange, Chain, Agent architecture, financial workflows,
and evidence. External providers supply external capabilities only.

Canonical command:

```
npm run provider:test
npm run provider:certify
```

Harness output distinguishes `CONTRACT_TEST_PASS`,
`SANDBOX_INTEGRATION_PASS`, and `EXTERNAL_CERTIFICATION_REQUIRED`.
Passing an internal suite never completes external certification.

## Shared requirements

For every category below:

- Implement the canonical SunRey interface. Do not rewrite domain
  logic around a vendor API.
- Bind credentials through the Chunk 149 provider credential plane.
  Raw secrets never enter domain configuration.
- Verify webhook signatures before mutation. Replay is rejected.
- Reconciliation compares SunRey expected state to provider reported
  state. The Ledger is never auto-adjusted to force a pass.
- Regulatory compatibility is a filter, not a score.
- Production activation requires certified adapters, contracts,
  licenses, counsel confirmation, and human authority. None of those
  are implied by sandbox success.

---

## BANKING

**Owner:** `packages/payments` (`src/production-candidate`)
**Canonical interface:** banking provider-candidate profile + account
reference classes. BaaS references are not Ledger balances.
**Required capabilities:** create/link external account reference,
balance/statement fetch for treasury reconciliation, inbound notice
(not automatic credit).
**Required credentials:** Chunk 149 descriptor; sandbox HMAC/API-key
reference only.
**Required webhook setup:** signed inbound/account events with nonce
and timestamp window.
**Certification suite:** payment/banking contract cases in
`npm run provider:certify`.
**Reconciliation:** provider operational balance is treasury evidence
only (`isCustomerLedgerBalance=false`).
**Security:** no plaintext credentials; no provider SDK in domain.
**External contracts/certifications:** bank contract, licensing,
security assessment. **Not present.**
**Production activation gates:** certified production banking adapter,
counsel-confirmed corridors, `LIVE_*` remain false until go-live
authorization. Current class:
`ADAPTER_ARCHITECTURE_READY` / `SANDBOX_READY` /
`REAL_PROVIDER_NOT_SELECTED`.

## PAYMENTS

**Owner:** `packages/payments` (`RailAdapter`)
**Canonical interface:** `RailAdapter` — validate, submit, query,
cancel, status, return, settlement report, health.
**Required capabilities:** submit, query-before-retry, cancel where
supported, webhook ingest, settlement report.
**Required credentials:** Chunk 149 descriptor bound to
`banking_worker`.
**Required webhook setup:** signed payment events; duplicate replay
rejected.
**Certification suite:** interchangeable A/B rail adapters.
**Reconciliation:** expected payment vs provider report; breaks
persist.
**Security:** adapter cannot issue Execution Authority or post
journals.
**External contracts/certifications:** rail/network membership,
sponsor bank. **Not present.**
**Production activation gates:** certified production payment
provider. Preflight fails closed if payments are enabled for
production without one. Current class: `SANDBOX_READY` /
`REAL_PROVIDER_NOT_SELECTED`.

## FX

**Owner:** `packages/payments` (`FxLiquidityProvider`)
**Canonical interface:** reference rate, quote, execute, status,
cancel. Rates are exact rationals. Float vendor rates are rejected.
**Required capabilities:** quote + execute. Execute missing while FX
execution is enabled fails closed.
**Required credentials:** FX liquidity credential descriptor.
**Required webhook setup:** optional trade-status callbacks; signature
required if used.
**Certification suite:** FX A/B domain workflow →
`FxQuoteDisclosure`.
**Reconciliation:** executed trade vs provider fill; Ledger is source
of posted cash.
**Security:** clients cannot choose rates. Simulation source is
`SIMULATION_REF_NOT_LIVE_MARKET`.
**External contracts/certifications:** liquidity contract, data
license. **Not present.**
**Production activation gates:** counsel-confirmed corridors.
`CONFIRMED_BY_COUNSEL` remains unset. Current class: `SANDBOX_READY` /
`REAL_PROVIDER_NOT_SELECTED`.

## CARDS

**Owner:** `packages/cards` (`CardProcessor`)
**Canonical interface:** issue/activate/freeze, authorize/capture/
refund, wallet provision. No PAN/CVV in the application plane.
**Required capabilities:** cardholder, virtual/physical issue, auth,
clear, refund, wallet eligibility.
**Required credentials:** processor callback HMAC in the credential
plane.
**Required webhook setup:** signed authorization/clearing/refund
callbacks.
**Certification suite:** existing card sandbox plus Phase D e2e
authorize/capture.
**Reconciliation:** card settlement records vs processor reports.
**Security:** PCI boundary stays outside this tree.
**External contracts/certifications:** issuer/processor, network
sponsorship, PCI. **Not present.**
**Production activation gates:** external certification + regulatory
approval. Current class: `SANDBOX_READY` /
`REAL_PROVIDER_NOT_SELECTED`.

## KYC/KYB

**Owner:** `packages/identity` (`IdentityVerificationProvider`)
**Canonical interface:** person, document, liveness, business,
beneficial ownership. Raw images/biometrics are rejected, not stored.
**Required capabilities:** PERSON_VERIFICATION,
BUSINESS_VERIFICATION, DOCUMENT_VERIFICATION.
**Required credentials:** `kyc_worker` binding. Cross-workload reuse
rejected.
**Required webhook setup:** signed identity events; no raw document
payloads persisted.
**Certification suite:** KYC A/B replacement test.
**Reconciliation:** not a balance domain; evidence refs only.
**Security:** KYC verified does not issue Execution Authority.
**External contracts/certifications:** DPA, residency, vendor SOC.
**Not present.**
**Production activation gates:** live KYC remains
`LIVE_EXTERNAL_KYC=false`. Current class: `SANDBOX_READY` /
`REAL_PROVIDER_NOT_SELECTED`.

## AML/SANCTIONS

**Owner:** `packages/kernel/src/compliance` provider-candidate
**Canonical interface:** sanctions, PEP, adverse media, transaction
monitoring, fraud. Provider scores are not Kernel decisions.
**Required capabilities:** screen / evaluate with fail-closed
`UNAVAILABLE`.
**Required credentials:** `screening_worker` / `case_management`.
**Required webhook setup:** signed alert events; unavailable is never
rewritten to CLEAR.
**Certification suite:** compliance fixtures + blockchain analytics
normalization.
**Reconciliation:** case/alert evidence only.
**Security:** provider output cannot authorize a payment or
withdrawal.
**External contracts/certifications:** list-source licenses, AML
program. **Not present.**
**Production activation gates:** sanctions unavailable fails closed.
Current class: `SANDBOX_READY` / `REAL_PROVIDER_NOT_SELECTED`.

## TRAVEL RULE

**Owner:** `packages/custody` Travel Rule ports + provider-candidate
**Canonical interface:** discover counterparty, submit sealed
originator/beneficiary pack. Payload is not placed on a public chain.
**Required capabilities:** discover, submit, acknowledge.
**Required credentials:** `travel_rule_worker`.
**Required webhook setup:** sealed acknowledgements only.
**Certification suite:** custody withdrawal workflow requires Travel
Rule satisfaction before the adapter is invoked.
**Reconciliation:** message acknowledgement vs withdrawal state.
**Security:** AI cannot bypass Travel Rule. Pack legal status remains
`RESEARCH_REQUIRED`.
**External contracts/certifications:** Travel Rule network membership.
**Not present.**
**Production activation gates:** custody withdrawals enabled without
Travel Rule availability fail closed. Current class: `SANDBOX_READY` /
`REAL_PROVIDER_NOT_SELECTED`.

## CUSTODY

**Owner:** `packages/custody` (`src/provider-candidate`)
**Canonical interface:** `CustodyProviderContract` — vault, wallet,
address, balance, deposit address, withdrawal, approve/sign,
transaction, fee, policy, webhook.
**Required capabilities:** listed on the contract. Provider vocabulary
is normalized onto existing deposit/withdrawal states.
**Required credentials:** `custody_worker`; HSM/KMS handles are not
exportable private keys.
**Required webhook setup:** deposit, withdrawal, transaction, wallet,
policy, signing, security — signature verified first.
**Certification suite:** `runCustodyContractSuite` (wallet, deposit,
confirmation, withdrawal, approval, pending, rejected, failed,
duplicate webhook, unknown transaction, fee, reconciliation,
environment isolation).
**Reconciliation:** four planes — SunRey Chain protocol state, custody
provider reported state, Exchange internal position, customer product
read model. None silently becomes a fiat Ledger balance.
**Security:** unverified callbacks do not credit. AI cannot bypass the
withdrawal sequence. Execution Authority is required before the
adapter runs.
**External contracts/certifications:** qualified custodian agreement,
HSM attestation. **Not present.**
**Production activation gates:** real custodian not selected.
Current class: `SANDBOX_READY` / `REAL_PROVIDER_NOT_SELECTED`.

## BLOCKCHAIN ANALYTICS

**Owner:** `packages/kernel/src/compliance/provider-candidate`
**Canonical interface:** `screenAddress`, `screenTransaction`,
`getExposure`, `getRiskSignals` → compliance findings.
**Required capabilities:** those four operations.
**Required credentials:** screening credential binding.
**Required webhook setup:** optional; signature required if used.
**Certification suite:** analytics contract suite.
**Reconciliation:** finding evidence refs only.
**Security:** analytics cannot approve or deny a withdrawal
independently of Kernel/compliance policy. `UNAVAILABLE` fails closed.
**External contracts/certifications:** analytics vendor contract.
**Not present.**
**Production activation gates:** real analytics vendor not selected.
Current class: `SANDBOX_READY` / `REAL_PROVIDER_NOT_SELECTED`.

## MARKET DATA

**Owner:** `packages/sunrey-exchange/src/market-data`
**Canonical interface:** instrument, spot, ticker, OHLC, historical,
reference rate, market status. Every price carries instrument, price,
currency, source, timestamp, freshness, provider, quality/status.
**Required capabilities:** those reads. Stale prices stay labeled
`STALE` and never masquerade as current.
**Required credentials:** market-data credential descriptor when a
vendor is selected.
**Required webhook setup:** none required for pull; push must verify
signatures.
**Certification suite:** market-data contract + multi-provider
selection policy (`PRIMARY`, `SECONDARY_FAILOVER`,
`CONSENSUS_IF_COMPATIBLE`, `REJECT_INCOMPATIBLE`).
**Reconciliation:** not a balance authority. Incompatible prices are
not averaged.
**Security:** bigint minor units only. No live vendor connected.
**External contracts/certifications:** data license. **Not present.**
**Production activation gates:** real market-data vendor not selected.
Current class: `SANDBOX_READY` / `REAL_PROVIDER_NOT_SELECTED`.

## ORACLE

**Owner:** `packages/sunrey-chain/src/oracle/production`
**Canonical interface:** external observation with data type,
quantity, unit, timestamp, source, license/provenance, verification,
quality/confidence, expiry/freshness.
**Required capabilities:** observe + provenance for energy, compute,
manufacturing, agriculture, real estate, logistics.
**Required credentials:** `oracle_collector` only. Consensus has no
provider egress.
**Required webhook setup:** off-chain collection only; consensus never
calls HTTP.
**Certification suite:** oracle productization suite (normal, expired,
invalid signature, unavailable, conflicting).
**Reconciliation:** observation vs feed schema; not AssetSupplyBook.
**Security:** observation `mintsMoonRey=false` and cannot alter
economic supply. Unverified data cannot invent productive value.
**External contracts/certifications:** data license, provider
certification evidence. **Not present.**
**Production activation gates:** Chunk 128 certification remains
engineering-only. Current class: `SANDBOX_READY` /
`REAL_PROVIDER_NOT_SELECTED`.
