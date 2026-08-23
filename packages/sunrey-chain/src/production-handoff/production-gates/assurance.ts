export type AssuranceAudience =
  | 'SECURITY_AUDITOR'
  | 'PENETRATION_TESTER'
  | 'LEGAL_COUNSEL'
  | 'REGULATOR'
  | 'BANK_PROVIDER'
  | 'CUSTODIAN'
  | 'EXCHANGE_REVIEWER'
  | 'PRIVACY_REVIEWER';

export type AssurancePackage = {
  readonly audience: AssuranceAudience;
  readonly title: string;
  readonly preparedPaths: readonly string[];
  readonly missingExternal: readonly string[];
  readonly notes: string;
};

export function externalAssurancePackages(): readonly AssurancePackage[] {
  return Object.freeze([
    Object.freeze({
      audience: 'SECURITY_AUDITOR',
      title: 'Security architecture and cryptography review pack',
      preparedPaths: [
        'packages/sunrey-chain/src/audit/',
        'docs/audit/',
        'packages/sunrey-range/',
        'packages/security/src/',
        'docs/productization/SUNREY_PRODUCTION_ARCHITECTURE_FREEZE.md',
      ],
      missingExternal: ['sec.external-architecture-review', 'sec.cryptography-review', 'sec.dependency-baseline'],
      notes: 'Engineering review packages exist. They do not claim an external audit occurred.',
    }),
    Object.freeze({
      audience: 'PENETRATION_TESTER',
      title: 'Penetration-test handoff',
      preparedPaths: [
        'packages/sunrey-range/',
        'packages/sunrey-chain/src/assurance/',
        'docs/productization/SUNREY_TEST_CLASSIFICATION.md',
      ],
      missingExternal: ['sec.external-pentest', 'sec.critical-findings-remediated'],
      notes: 'The adversarial range is isolated and fixture-only. Internal tests are not EXTERNAL_PENTEST_COMPLETE.',
    }),
    Object.freeze({
      audience: 'LEGAL_COUNSEL',
      title: 'Legal evidence registry slots',
      preparedPaths: [
        'docs/productization/sunrey-external-input-registry.json',
        'packages/sunrey-chain/src/production-handoff/production-gates/catalog.ts',
        'packages/consent/src/taxonomy.ts',
      ],
      missingExternal: ['legal.opinions', 'legal.terms', 'legal.privacy-policy', 'legal.customer-agreements'],
      notes: 'Slots only. This package does not draft substantive legal conclusions.',
    }),
    Object.freeze({
      audience: 'REGULATOR',
      title: 'Regulatory readiness and operating-scope pack',
      preparedPaths: [
        'packages/sunrey-chain/src/mainnet/operating-scope/',
        'packages/regulatory-twin/src/',
        'docs/productization/sunrey-authority-map.json',
      ],
      missingExternal: ['reg.banking-payment-permission', 'reg.money-transmission', 'reg.digital-asset-exchange'],
      notes: 'Unknown corridors remain RESEARCH_REQUIRED. COUNSEL_REVIEW_REQUIRED is represented, not resolved.',
    }),
    Object.freeze({
      audience: 'BANK_PROVIDER',
      title: 'Bank / payment-rail / FX certification handoff',
      preparedPaths: [
        'docs/productization/SUNREY_FINANCIAL_PROVIDER_ONBOARDING_CHECKLIST.md',
        'docs/productization/SUNREY_PROVIDER_INTEGRATION_STANDARD.md',
        'packages/payments/src/production-candidate/',
      ],
      missingExternal: ['prv.bank-baas', 'prv.payment-rails', 'prv.fx'],
      notes: 'Sandbox conformance only. LIVE_PAYMENTS_ENABLED remains false.',
    }),
    Object.freeze({
      audience: 'CUSTODIAN',
      title: 'Custody and Travel Rule certification handoff',
      preparedPaths: [
        'packages/custody/src/provider-candidate/',
        'docs/productization/SUNREY_COMPLIANCE_PROVIDER_ONBOARDING_CHECKLIST.md',
      ],
      missingExternal: ['prv.custody', 'prv.travel-rule', 'legal.custody-agreements'],
      notes: 'Simulation custody is not a qualified custodian.',
    }),
    Object.freeze({
      audience: 'EXCHANGE_REVIEWER',
      title: 'Exchange review pack',
      preparedPaths: [
        'docs/productization/sunrey-exchange-production-gate.json',
        'packages/sunrey-exchange/src/productization/gates.ts',
        'packages/market-surveillance/src/',
      ],
      missingExternal: ['ex.regulatory-authorization', 'ex.market-rules', 'ex.security-review'],
      notes: 'Software complete internally. Exchange production stays fail-closed.',
    }),
    Object.freeze({
      audience: 'PRIVACY_REVIEWER',
      title: 'Privacy / HIN / PDV review pack',
      preparedPaths: [
        'packages/personal-data-vault/src/',
        'packages/consent/src/',
        'packages/information-market/src/',
        'docs/productization/SUNREY_DATA_PURPOSE_REGISTRY.md',
      ],
      missingExternal: ['priv.privacy-counsel', 'priv.consent-language', 'priv.marketplace-legal-structure'],
      notes: 'Engineering classes are not GDPR/CCPA/PDPL/HIPAA categories.',
    }),
  ]);
}

export type ProviderCertificationHandoff = {
  readonly family: string;
  readonly tests: string;
  readonly credentials: string;
  readonly webhooks: string;
  readonly reconciliation: string;
  readonly certification: string;
  readonly limitedLivePath: string;
};

export function providerCertificationHandoffs(): readonly ProviderCertificationHandoff[] {
  return Object.freeze([
    row('bank-baas', 'packages/payments + services/accounts Kernel-gated money tests', 'Chunk 149 credential plane; raw secrets never enter domain config', 'Authenticated, replay-protected payment webhooks', 'Ledger vs provider balance acceptance pack', 'Sandbox → CERTIFICATION → PREPRODUCTION. PRODUCTION stays blocked', 'Limited-live requires bank-baas + KYC + AML + legal.terms + pentest'),
    row('payment-rails', 'packages/payments rail adapter sandbox tests', 'Production-candidate rail credentials only after human approval', 'Rail webhook normalization tests', 'Rail settlement vs Ledger', 'SUNREY_PROVIDER_INTEGRATION_STANDARD certification procedure', 'Limited-live subset of rails after counsel + contract'),
    row('fx', 'FX quote/execute simulation tests', 'FX provider credential reference', 'FX status webhooks', 'Quoted vs executed vs Ledger', 'Sandbox certification against SunRey FX port', 'Limited-live FX after provider + legal.dpa'),
    row('cards', 'packages/cards spending-control tests; no PAN/CVV', 'Issuer credentials via credential plane', 'Issuer webhook normalization', 'Auth/clearing vs Ledger', 'PCI-minimized certification; live issuer disconnected', 'Cards are PRODUCTION-only, not limited-live default'),
    row('kyc', 'packages/identity provider-candidate tests', 'KYC vendor credentials; LIVE_EXTERNAL_KYC stays false until authorized', 'KYC webhook + case updates', 'Identity state vs provider case id', 'Compliance onboarding checklist', 'Limited-live onboarding requires KYC + privacy counsel'),
    row('aml-sanctions', 'packages/kernel compliance provider-candidate tests', 'AML/sanctions credentials', 'Alert/case webhooks', 'Screening decisions remain Kernel-owned', 'Fixture adapters only until certification', 'Limited-live payments require AML + sanctions'),
    row('travel-rule', 'custody Travel Rule fixture tests', 'Travel Rule network membership evidence', 'IVMS/originator webhooks', 'Withdrawal blocked while pending', 'No network connected today', 'Not in limited-live default; required for Exchange/mainnet'),
    row('custody', 'packages/custody dual-asset isolation tests', 'Custodian credentials + HSM attestation', 'Deposit/withdrawal webhooks', 'Custody vs Ledger vs Chain', 'Qualified-custody certification pack', 'Required before Exchange production and mainnet'),
    row('market-data', 'packages/sunrey-exchange market-data contract tests', 'Licensed feed credentials', 'Quote webhooks/snapshots', 'Feed vs Exchange indicator reconciliation', 'Sandbox feed is not a license', 'Exchange production only'),
    row('oracles', 'sunrey-chain oracle certification + conformance sandbox', 'Oracle provider onboarding packet', 'Injected transports only', 'Observation vs unit taxonomy; no minting', 'Chunk 128 certification. Production valuation inactive', 'Mainnet / productive economy only'),
    row('blockchain-analytics', 'kernel blockchain-analytics fixture tests', 'Analytics vendor credentials', 'Alert webhooks', 'Alerts are proposals; Kernel decides', 'Fixture adapter only', 'Exchange / production withdrawals'),
    row('ai-model', 'packages/ai-runtime + sunrey-agent eval isolation tests', 'Approved model provider + DPA', 'No model webhook becomes Execution Authority', 'Prompt-injection and hallucination suites must be registered externally', 'SUNREY_AI_MODEL_PROVIDER_STANDARD', 'Limited-live Agent requires approved provider + kill switches + human escalation'),
  ]);
}

function row(
  family: string,
  tests: string,
  credentials: string,
  webhooks: string,
  reconciliation: string,
  certification: string,
  limitedLivePath: string,
): ProviderCertificationHandoff {
  return Object.freeze({
    family,
    tests,
    credentials,
    webhooks,
    reconciliation,
    certification,
    limitedLivePath,
  });
}
