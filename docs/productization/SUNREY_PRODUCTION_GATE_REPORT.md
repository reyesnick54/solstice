# SunRey Production Gate Report

Generated from the machine-readable External Input Registry.
This report does not grant licenses, legal approvals, or activate production.

## Distinction

- BACKEND SOFTWARE READY=true
- EXTERNAL GATES MISSING=true
- PRODUCTION ACTIVE=false
- PRODUCTION_READY=false
- LIVE_CONNECTIVITY_ENABLED=false
- RELEASE_DECISION=BLOCKED

## Evaluation

- schema: `sunrey.external-input.registry.v1`
- evaluatedAtUtc: `2026-08-23T00:00:00.000Z`
- failClosed: true
- totalGates: 257
- satisfiedInternalGates: 37
- missingExternalGates: 220
- expiredGates: 0
- unverifiedGates: 0
- registryHash: `f26a727142798b5b684efdc1ee6b6d1c345e7ae537f6665b42b73b201ecdc849`
- decisionHash: `b3728d6ba464ed942362f675a54fef852987cb32061f2551612458193a540c2c`

## Category counts

- INTERNAL_SOFTWARE: 22
- GOVERNANCE: 5
- AI: 18
- REGULATORY: 34
- LEGAL: 11
- PROVIDER: 12
- BANKING: 9
- PAYMENTS: 17
- CARDS: 9
- CUSTODY: 16
- EXCHANGE: 21
- BLOCKCHAIN: 14
- SECURITY: 9
- PRIVACY: 6
- DATA_MARKETPLACE: 4
- INFRASTRUCTURE: 4
- OPERATIONS: 15
- TRAINING: 5
- BUSINESS_CONTINUITY: 5
- RECONCILIATION: 6
- CUSTOMER_EXPERIENCE: 14
- INVESTMENTS: 1

## Currently satisfied internal gates

- `int.ledger-software`
- `int.kernel-software`
- `int.accounts-service`
- `int.identity-software`
- `int.evidence-vault`
- `int.platform-api`
- `int.consumer-bff`
- `int.exchange-core`
- `int.chain-runtime`
- `int.agent-proposal-gate`
- `int.consent-pdv`
- `int.hin-software`
- `int.custody-simulation`
- `int.payments-simulation`
- `int.cards-simulation`
- `int.fx-simulation`
- `int.ai-runtime`
- `int.persistence`
- `int.ci-quality-gate`
- `int.surveillance-detectors`
- `int.travel-rule-fixture`
- `int.provider-runtime`
- `int.gate-exception-process`
- `ai.kill-switches`
- `ai.human-escalation`
- `cx.authentication`
- `cx.home`
- `cx.money`
- `cx.send`
- `cx.fx`
- `cx.cards`
- `cx.grow`
- `cx.agent`
- `cx.exchange`
- `cx.vault`
- `cx.profile-security`
- `cx.support`

## Regulatory gates

- `reg.banking-payment-permission` — MISSING — Banking / payment permissions applicable to offered products
- `reg.money-transmission` — MISSING — Money-transmission / payment-institution requirements
- `reg.investment-brokerage` — MISSING — Investment / brokerage permissions
- `reg.digital-asset-exchange` — MISSING — Digital-asset / Exchange permissions
- `reg.custody-permission` — MISSING — Custody permissions / qualifications
- `reg.privacy-data-processing` — MISSING — Privacy / data-processing permissions
- `reg.consumer-protection` — MISSING — Consumer-protection requirements
- `reg.financial-promotion` — MISSING — Financial-promotion / marketing permissions
- `reg.travel-rule` — MISSING — Travel Rule obligations where required
- `reg.market-surveillance` — MISSING — Market-surveillance operational requirements

## Provider gates

- `prv.bank-baas` — MISSING — Bank / BaaS provider production evidence bundle
- `prv.bank-baas.production-credentials` — MISSING — Bank / BaaS provider: production credentials
- `prv.bank-baas.contract` — MISSING — Bank / BaaS provider: contract
- `prv.bank-baas.sandbox-certification` — MISSING — Bank / BaaS provider: sandbox certification
- `prv.bank-baas.webhooks-validated` — MISSING — Bank / BaaS provider: webhooks validated
- `prv.bank-baas.reconciliation-validated` — MISSING — Bank / BaaS provider: reconciliation validated
- `prv.bank-baas.operational-contacts` — MISSING — Bank / BaaS provider: operational contacts
- `prv.bank-baas.incident-path` — MISSING — Bank / BaaS provider: incident path
- `prv.bank-baas.production-approval` — MISSING — Bank / BaaS provider: production approval
- `prv.payment-rails` — MISSING — Payment rail provider production evidence bundle
- `prv.payment-rails.production-credentials` — MISSING — Payment rail provider: production credentials
- `prv.payment-rails.contract` — MISSING — Payment rail provider: contract
- `prv.payment-rails.sandbox-certification` — MISSING — Payment rail provider: sandbox certification
- `prv.payment-rails.webhooks-validated` — MISSING — Payment rail provider: webhooks validated
- `prv.payment-rails.reconciliation-validated` — MISSING — Payment rail provider: reconciliation validated
- `prv.payment-rails.operational-contacts` — MISSING — Payment rail provider: operational contacts
- `prv.payment-rails.incident-path` — MISSING — Payment rail provider: incident path
- `prv.payment-rails.production-approval` — MISSING — Payment rail provider: production approval
- `prv.fx` — MISSING — FX provider production evidence bundle
- `prv.fx.production-credentials` — MISSING — FX provider: production credentials
- `prv.fx.contract` — MISSING — FX provider: contract
- `prv.fx.sandbox-certification` — MISSING — FX provider: sandbox certification
- `prv.fx.webhooks-validated` — MISSING — FX provider: webhooks validated
- `prv.fx.reconciliation-validated` — MISSING — FX provider: reconciliation validated
- `prv.fx.operational-contacts` — MISSING — FX provider: operational contacts
- `prv.fx.incident-path` — MISSING — FX provider: incident path
- `prv.fx.production-approval` — MISSING — FX provider: production approval
- `prv.cards` — MISSING — Card issuer / processor production evidence bundle
- `prv.cards.production-credentials` — MISSING — Card issuer / processor: production credentials
- `prv.cards.contract` — MISSING — Card issuer / processor: contract
- `prv.cards.sandbox-certification` — MISSING — Card issuer / processor: sandbox certification
- `prv.cards.webhooks-validated` — MISSING — Card issuer / processor: webhooks validated
- `prv.cards.reconciliation-validated` — MISSING — Card issuer / processor: reconciliation validated
- `prv.cards.operational-contacts` — MISSING — Card issuer / processor: operational contacts
- `prv.cards.incident-path` — MISSING — Card issuer / processor: incident path
- `prv.cards.production-approval` — MISSING — Card issuer / processor: production approval
- `prv.kyc` — MISSING — KYC provider production evidence bundle
- `prv.kyc.production-credentials` — MISSING — KYC provider: production credentials
- `prv.kyc.contract` — MISSING — KYC provider: contract
- `prv.kyc.sandbox-certification` — MISSING — KYC provider: sandbox certification
- `prv.kyc.webhooks-validated` — MISSING — KYC provider: webhooks validated
- `prv.kyc.reconciliation-validated` — MISSING — KYC provider: reconciliation validated
- `prv.kyc.operational-contacts` — MISSING — KYC provider: operational contacts
- `prv.kyc.incident-path` — MISSING — KYC provider: incident path
- `prv.kyc.production-approval` — MISSING — KYC provider: production approval
- `prv.aml-sanctions` — MISSING — AML / sanctions provider production evidence bundle
- `prv.aml-sanctions.production-credentials` — MISSING — AML / sanctions provider: production credentials
- `prv.aml-sanctions.contract` — MISSING — AML / sanctions provider: contract
- `prv.aml-sanctions.sandbox-certification` — MISSING — AML / sanctions provider: sandbox certification
- `prv.aml-sanctions.webhooks-validated` — MISSING — AML / sanctions provider: webhooks validated
- `prv.aml-sanctions.reconciliation-validated` — MISSING — AML / sanctions provider: reconciliation validated
- `prv.aml-sanctions.operational-contacts` — MISSING — AML / sanctions provider: operational contacts
- `prv.aml-sanctions.incident-path` — MISSING — AML / sanctions provider: incident path
- `prv.aml-sanctions.production-approval` — MISSING — AML / sanctions provider: production approval
- `prv.travel-rule` — MISSING — Travel Rule provider production evidence bundle
- `prv.travel-rule.production-credentials` — MISSING — Travel Rule provider: production credentials
- `prv.travel-rule.contract` — MISSING — Travel Rule provider: contract
- `prv.travel-rule.sandbox-certification` — MISSING — Travel Rule provider: sandbox certification
- `prv.travel-rule.webhooks-validated` — MISSING — Travel Rule provider: webhooks validated
- `prv.travel-rule.reconciliation-validated` — MISSING — Travel Rule provider: reconciliation validated
- `prv.travel-rule.operational-contacts` — MISSING — Travel Rule provider: operational contacts
- `prv.travel-rule.incident-path` — MISSING — Travel Rule provider: incident path
- `prv.travel-rule.production-approval` — MISSING — Travel Rule provider: production approval
- `prv.custody` — MISSING — Custody provider production evidence bundle
- `prv.custody.production-credentials` — MISSING — Custody provider: production credentials
- `prv.custody.contract` — MISSING — Custody provider: contract
- `prv.custody.sandbox-certification` — MISSING — Custody provider: sandbox certification
- `prv.custody.webhooks-validated` — MISSING — Custody provider: webhooks validated
- `prv.custody.reconciliation-validated` — MISSING — Custody provider: reconciliation validated
- `prv.custody.operational-contacts` — MISSING — Custody provider: operational contacts
- `prv.custody.incident-path` — MISSING — Custody provider: incident path
- `prv.custody.production-approval` — MISSING — Custody provider: production approval
- `prv.market-data` — MISSING — Market-data provider production evidence bundle
- `prv.market-data.production-credentials` — MISSING — Market-data provider: production credentials
- `prv.market-data.contract` — MISSING — Market-data provider: contract
- `prv.market-data.sandbox-certification` — MISSING — Market-data provider: sandbox certification
- `prv.market-data.webhooks-validated` — MISSING — Market-data provider: webhooks validated
- `prv.market-data.reconciliation-validated` — MISSING — Market-data provider: reconciliation validated
- `prv.market-data.operational-contacts` — MISSING — Market-data provider: operational contacts
- `prv.market-data.incident-path` — MISSING — Market-data provider: incident path
- `prv.market-data.production-approval` — MISSING — Market-data provider: production approval
- `prv.oracles` — MISSING — Oracle / economic-data provider production evidence bundle
- `prv.oracles.production-credentials` — MISSING — Oracle / economic-data provider: production credentials
- `prv.oracles.contract` — MISSING — Oracle / economic-data provider: contract
- `prv.oracles.sandbox-certification` — MISSING — Oracle / economic-data provider: sandbox certification
- `prv.oracles.webhooks-validated` — MISSING — Oracle / economic-data provider: webhooks validated
- `prv.oracles.reconciliation-validated` — MISSING — Oracle / economic-data provider: reconciliation validated
- `prv.oracles.operational-contacts` — MISSING — Oracle / economic-data provider: operational contacts
- `prv.oracles.incident-path` — MISSING — Oracle / economic-data provider: incident path
- `prv.oracles.production-approval` — MISSING — Oracle / economic-data provider: production approval
- `prv.blockchain-analytics` — MISSING — Blockchain analytics provider production evidence bundle
- `prv.blockchain-analytics.production-credentials` — MISSING — Blockchain analytics provider: production credentials
- `prv.blockchain-analytics.contract` — MISSING — Blockchain analytics provider: contract
- `prv.blockchain-analytics.sandbox-certification` — MISSING — Blockchain analytics provider: sandbox certification
- `prv.blockchain-analytics.webhooks-validated` — MISSING — Blockchain analytics provider: webhooks validated
- `prv.blockchain-analytics.reconciliation-validated` — MISSING — Blockchain analytics provider: reconciliation validated
- `prv.blockchain-analytics.operational-contacts` — MISSING — Blockchain analytics provider: operational contacts
- `prv.blockchain-analytics.incident-path` — MISSING — Blockchain analytics provider: incident path
- `prv.blockchain-analytics.production-approval` — MISSING — Blockchain analytics provider: production approval
- `prv.ai-model` — MISSING — AI model provider production evidence bundle
- `prv.ai-model.production-credentials` — MISSING — AI model provider: production credentials
- `prv.ai-model.contract` — MISSING — AI model provider: contract
- `prv.ai-model.sandbox-certification` — MISSING — AI model provider: sandbox certification
- `prv.ai-model.webhooks-validated` — MISSING — AI model provider: webhooks validated
- `prv.ai-model.reconciliation-validated` — MISSING — AI model provider: reconciliation validated
- `prv.ai-model.operational-contacts` — MISSING — AI model provider: operational contacts
- `prv.ai-model.incident-path` — MISSING — AI model provider: incident path
- `prv.ai-model.production-approval` — MISSING — AI model provider: production approval

## Security gates

- `sec.external-architecture-review` — MISSING — External security architecture review
- `sec.external-pentest` — MISSING — External penetration test
- `sec.protocol-chain-audit` — MISSING — Protocol / Chain audit
- `sec.exchange-review` — MISSING — Exchange security review
- `sec.cryptography-review` — MISSING — Cryptography review
- `sec.critical-findings-remediated` — MISSING — Critical findings remediated
- `sec.dependency-baseline` — MISSING — Dependency / security baseline
- `sec.hsm-kms` — MISSING — Production HSM / KMS
- `sec.key-ceremony-readiness` — MISSING — Key-ceremony readiness

## AI gates

- `ai.kill-switches` — VERIFIED — Agent/model kill-switch software path
- `ai.human-escalation` — VERIFIED — Human escalation path for Agent proposals
- `ai.approved-model-provider` — MISSING — Approved model provider
- `ai.dpa-privacy-review` — MISSING — DPA / privacy review for model processing
- `ai.financial-agent-eval` — MISSING — Financial Agent evaluation threshold
- `ai.prompt-injection-suite` — MISSING — Prompt-injection evaluation suite result
- `ai.hallucination-suite` — MISSING — Hallucination evaluation suite result
- `ai.red-team-result` — MISSING — AI red-team result
- `ai.model-version-pinning` — MISSING — Model version pinning
- `ai.operational-monitoring` — MISSING — Agent operational monitoring

## Privacy / HIN gates

- `priv.privacy-counsel` — MISSING — Privacy counsel review
- `priv.consent-language` — MISSING — Consent language
- `priv.retention-schedule` — MISSING — Retention schedule
- `priv.rights-request-process` — MISSING — Data-subject rights-request process
- `priv.data-source-contracts` — MISSING — Data-source contracts
- `priv.data-licenses` — MISSING — Data licenses
- `priv.dpa` — MISSING — Privacy DPA coverage
- `priv.marketplace-legal-structure` — MISSING — Data-marketplace legal structure
- `priv.approved-valuation-methodology` — MISSING — Approved HIN / contribution valuation methodology
- `priv.approved-compensation-methodology` — MISSING — Approved compensation methodology

## Exchange / Mainnet gates

- `ex.regulatory-authorization` — MISSING — Exchange regulatory authorization
- `ex.market-rules` — MISSING — Approved market rules
- `ex.listing-approvals` — MISSING — Listing approvals
- `ex.custody` — MISSING — Qualified Exchange custody
- `ex.banking-settlement` — MISSING — Banking / settlement
- `ex.market-data` — MISSING — Licensed market data
- `ex.surveillance` — MISSING — Staffed market surveillance
- `ex.travel-rule` — MISSING — Exchange Travel Rule
- `ex.compliance` — MISSING — Exchange compliance operations
- `ex.staffing` — MISSING — Exchange operational staffing
- `ex.security-review` — MISSING — Exchange security review evidence
- `ex.incident-management` — MISSING — Exchange incident management
- `ex.production-capital-liquidity` — MISSING — Production capital / liquidity requirements
- `chain.final-genesis` — MISSING — Final genesis
- `chain.economic-parameters` — MISSING — Final economic parameters
- `chain.native-asset-parameters` — MISSING — Native-asset parameters
- `chain.governance-authorization` — MISSING — Governance authorization
- `chain.validator-operators` — MISSING — Validator operators
- `chain.hsm-kms` — MISSING — Chain HSM / KMS
- `chain.protocol-audit` — MISSING — Protocol audit
- `chain.genesis-ceremony` — MISSING — Genesis ceremony
- `chain.infrastructure` — MISSING — Production infrastructure
- `chain.monitoring` — MISSING — Chain monitoring
- `chain.on-call` — MISSING — On-call acceptance
- `chain.incident-response` — MISSING — Incident response
- `chain.backup-recovery` — MISSING — Backup / recovery
- `chain.mainnet-activation-approval` — MISSING — Mainnet activation approval

## Staffing gates

- `ops.compliance-operations` — MISSING — Compliance operations role filled
- `ops.fraud` — MISSING — Fraud operations role filled
- `ops.payments` — MISSING — Payments operations role filled
- `ops.treasury` — MISSING — Treasury role filled
- `ops.reconciliation` — MISSING — Reconciliation role filled
- `ops.exchange-surveillance` — MISSING — Exchange surveillance role filled
- `ops.custody-operations` — MISSING — Custody operations role filled
- `ops.sre-oncall` — MISSING — SRE / on-call role filled
- `ops.security` — MISSING — Security operations role filled
- `ops.customer-support` — MISSING — Customer support role filled
- `ops.incident-commander` — MISSING — Incident commander role filled
- `ops.data-privacy` — MISSING — Data privacy role filled
- `ops.agent-operations` — MISSING — Agent operations role filled

Named people are not assigned. Required roles: COMPLIANCE_OPERATIONS, FRAUD, PAYMENTS, TREASURY, RECONCILIATION, EXCHANGE_SURVEILLANCE, CUSTODY_OPERATIONS, SRE_ONCALL, SECURITY, CUSTOMER_SUPPORT, INCIDENT_COMMANDER, DATA_PRIVACY, AGENT_OPERATIONS.

## Current release decision

`BLOCKED`

Ordinary developers, AI, and the Agent cannot override missing required gates.
Human governance may record an auditable exception only for explicitly eligible gates.

## Production ceremony readiness

- prepared: true
- executed: false
- Do not execute the ceremony from this report.

