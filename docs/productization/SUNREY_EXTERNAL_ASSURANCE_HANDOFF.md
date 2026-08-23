# SunRey External Assurance Handoff

Packages prepared for external reviewers. Prepared is not performed.
Internal tests are not external audits.

## SECURITY_AUDITOR — Security architecture and cryptography review pack

Engineering review packages exist. They do not claim an external audit occurred.

Prepared paths:
- `packages/sunrey-chain/src/audit/`
- `docs/audit/`
- `packages/sunrey-range/`
- `packages/security/src/`
- `docs/productization/SUNREY_PRODUCTION_ARCHITECTURE_FREEZE.md`

Still missing:
- `sec.external-architecture-review`
- `sec.cryptography-review`
- `sec.dependency-baseline`

## PENETRATION_TESTER — Penetration-test handoff

The adversarial range is isolated and fixture-only. Internal tests are not EXTERNAL_PENTEST_COMPLETE.

Prepared paths:
- `packages/sunrey-range/`
- `packages/sunrey-chain/src/assurance/`
- `docs/productization/SUNREY_TEST_CLASSIFICATION.md`

Still missing:
- `sec.external-pentest`
- `sec.critical-findings-remediated`

## LEGAL_COUNSEL — Legal evidence registry slots

Slots only. This package does not draft substantive legal conclusions.

Prepared paths:
- `docs/productization/sunrey-external-input-registry.json`
- `packages/sunrey-chain/src/production-handoff/production-gates/catalog.ts`
- `packages/consent/src/taxonomy.ts`

Still missing:
- `legal.opinions`
- `legal.terms`
- `legal.privacy-policy`
- `legal.customer-agreements`

## REGULATOR — Regulatory readiness and operating-scope pack

Unknown corridors remain RESEARCH_REQUIRED. COUNSEL_REVIEW_REQUIRED is represented, not resolved.

Prepared paths:
- `packages/sunrey-chain/src/mainnet/operating-scope/`
- `packages/regulatory-twin/src/`
- `docs/productization/sunrey-authority-map.json`

Still missing:
- `reg.banking-payment-permission`
- `reg.money-transmission`
- `reg.digital-asset-exchange`

## BANK_PROVIDER — Bank / payment-rail / FX certification handoff

Sandbox conformance only. LIVE_PAYMENTS_ENABLED remains false.

Prepared paths:
- `docs/productization/SUNREY_FINANCIAL_PROVIDER_ONBOARDING_CHECKLIST.md`
- `docs/productization/SUNREY_PROVIDER_INTEGRATION_STANDARD.md`
- `packages/payments/src/production-candidate/`

Still missing:
- `prv.bank-baas`
- `prv.payment-rails`
- `prv.fx`

## CUSTODIAN — Custody and Travel Rule certification handoff

Simulation custody is not a qualified custodian.

Prepared paths:
- `packages/custody/src/provider-candidate/`
- `docs/productization/SUNREY_COMPLIANCE_PROVIDER_ONBOARDING_CHECKLIST.md`

Still missing:
- `prv.custody`
- `prv.travel-rule`
- `legal.custody-agreements`

## EXCHANGE_REVIEWER — Exchange review pack

Software complete internally. Exchange production stays fail-closed.

Prepared paths:
- `docs/productization/sunrey-exchange-production-gate.json`
- `packages/sunrey-exchange/src/productization/gates.ts`
- `packages/market-surveillance/src/`

Still missing:
- `ex.regulatory-authorization`
- `ex.market-rules`
- `ex.security-review`

## PRIVACY_REVIEWER — Privacy / HIN / PDV review pack

Engineering classes are not GDPR/CCPA/PDPL/HIPAA categories.

Prepared paths:
- `packages/personal-data-vault/src/`
- `packages/consent/src/`
- `packages/information-market/src/`
- `docs/productization/SUNREY_DATA_PURPOSE_REGISTRY.md`

Still missing:
- `priv.privacy-counsel`
- `priv.consent-language`
- `priv.marketplace-legal-structure`

## Provider certification handoff

| Family | Tests | Credentials | Webhooks | Reconciliation | Certification | Limited-live path |
| --- | --- | --- | --- | --- | --- | --- |
| bank-baas | packages/payments + services/accounts Kernel-gated money tests | Chunk 149 credential plane; raw secrets never enter domain config | Authenticated, replay-protected payment webhooks | Ledger vs provider balance acceptance pack | Sandbox → CERTIFICATION → PREPRODUCTION. PRODUCTION stays blocked | Limited-live requires bank-baas + KYC + AML + legal.terms + pentest |
| payment-rails | packages/payments rail adapter sandbox tests | Production-candidate rail credentials only after human approval | Rail webhook normalization tests | Rail settlement vs Ledger | SUNREY_PROVIDER_INTEGRATION_STANDARD certification procedure | Limited-live subset of rails after counsel + contract |
| fx | FX quote/execute simulation tests | FX provider credential reference | FX status webhooks | Quoted vs executed vs Ledger | Sandbox certification against SunRey FX port | Limited-live FX after provider + legal.dpa |
| cards | packages/cards spending-control tests; no PAN/CVV | Issuer credentials via credential plane | Issuer webhook normalization | Auth/clearing vs Ledger | PCI-minimized certification; live issuer disconnected | Cards are PRODUCTION-only, not limited-live default |
| kyc | packages/identity provider-candidate tests | KYC vendor credentials; LIVE_EXTERNAL_KYC stays false until authorized | KYC webhook + case updates | Identity state vs provider case id | Compliance onboarding checklist | Limited-live onboarding requires KYC + privacy counsel |
| aml-sanctions | packages/kernel compliance provider-candidate tests | AML/sanctions credentials | Alert/case webhooks | Screening decisions remain Kernel-owned | Fixture adapters only until certification | Limited-live payments require AML + sanctions |
| travel-rule | custody Travel Rule fixture tests | Travel Rule network membership evidence | IVMS/originator webhooks | Withdrawal blocked while pending | No network connected today | Not in limited-live default; required for Exchange/mainnet |
| custody | packages/custody dual-asset isolation tests | Custodian credentials + HSM attestation | Deposit/withdrawal webhooks | Custody vs Ledger vs Chain | Qualified-custody certification pack | Required before Exchange production and mainnet |
| market-data | packages/sunrey-exchange market-data contract tests | Licensed feed credentials | Quote webhooks/snapshots | Feed vs Exchange indicator reconciliation | Sandbox feed is not a license | Exchange production only |
| oracles | sunrey-chain oracle certification + conformance sandbox | Oracle provider onboarding packet | Injected transports only | Observation vs unit taxonomy; no minting | Chunk 128 certification. Production valuation inactive | Mainnet / productive economy only |
| blockchain-analytics | kernel blockchain-analytics fixture tests | Analytics vendor credentials | Alert webhooks | Alerts are proposals; Kernel decides | Fixture adapter only | Exchange / production withdrawals |
| ai-model | packages/ai-runtime + sunrey-agent eval isolation tests | Approved model provider + DPA | No model webhook becomes Execution Authority | Prompt-injection and hallucination suites must be registered externally | SUNREY_AI_MODEL_PROVIDER_STANDARD | Limited-live Agent requires approved provider + kill switches + human escalation |

