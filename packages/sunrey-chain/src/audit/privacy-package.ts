export const PRIVACY_REVIEW_PACKAGE = Object.freeze({
  title: 'Privacy review package',
  components: {
    pdv: {
      owner: 'packages/personal-data-vault',
      behavior: 'Subject-bound encrypted store. Plaintext hidden from metadata. Tamper and wrong-key fail closed.',
    },
    consentLedger: {
      owner: 'packages/consent',
      behavior: 'Consent artifacts are purpose-scoped. Revocation is first-class.',
    },
    purposeFirewall: {
      owner: 'packages/consent',
      behavior: 'Use without a matching purpose is denied.',
    },
    cleanRoom: {
      owner: 'packages/clean-room',
      behavior: 'Consent-gated constrained computation. Raw rows default DENY.',
    },
    informationRightMarkets: {
      owner: 'packages/information-market',
      behavior: 'Rights are traded as permissions, not as raw subject payloads.',
    },
    explorerExposure: {
      owner: 'packages/sunrey-explorer',
      policy: 'explorer.exposure.v1',
      defaultClass: 'FORBIDDEN',
      neverExpose: [
        'Personal Data Vault raw content',
        'raw Clean Room rows',
        'private KYC records',
        'private compliance screening',
        'private consent details',
        'private wallet key information',
      ],
    },
    metricsLogging: {
      owner: 'packages/sunrey-chain/src/ops/privacy.ts',
      behavior: 'Operator metrics must not include raw subject-level payloads or private keys.',
    },
  },
  prohibitedInterfaceTests: [
    'packages/personal-data-vault/src/personal-data-vault.test.ts',
    'packages/personal-data-vault/src/architecture-guards.test.ts',
    'packages/clean-room/src',
    'packages/consent/src',
    'packages/sunrey-explorer/src',
    'docs/architecture/explorer-privacy-policy.md',
  ],
  residualStatement:
    'Raw subject-level information remains unavailable through prohibited interfaces. Operator logs outside these packages can still leak if misconfigured.',
});
