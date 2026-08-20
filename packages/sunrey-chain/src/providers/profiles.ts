/**
 * Per-domain acceptance profiles. Required capabilities and evidence
 * are engineering requirements. They do not invent contracts or
 * licenses.
 */

import type {
  EvidenceClass,
  ExternalProviderAcceptanceProfile,
  HumanReviewerRole,
  ProviderDataClass,
  ProviderDomain,
} from './types.ts';

function profile(input: {
  readonly domain: ProviderDomain;
  readonly requiredCapabilities: readonly string[];
  readonly requiredEvidenceClasses: readonly EvidenceClass[];
  readonly requiredHumanReviewerRole: HumanReviewerRole;
  readonly canonicalRegistry: ExternalProviderAcceptanceProfile['canonicalRegistry'];
  readonly dataClasses: readonly ProviderDataClass[];
  readonly notes: string;
}): ExternalProviderAcceptanceProfile {
  return Object.freeze({
    ...input,
    requiredCapabilities: Object.freeze([...input.requiredCapabilities]),
    requiredEvidenceClasses: Object.freeze([...input.requiredEvidenceClasses]),
    dataClasses: Object.freeze([...input.dataClasses]),
  });
}

const COMMON_SECURITY: readonly EvidenceClass[] = Object.freeze([
  'SERVICE_CONTRACT',
  'SECURITY_ASSESSMENT',
  'SOC_ISO_OR_EQUIVALENT',
  'DATA_PROCESSING_AGREEMENT',
  'SERVICE_LEVEL_AGREEMENT',
  'BUSINESS_CONTINUITY',
  'HUMAN_APPROVAL',
]);

export const DOMAIN_PROFILES: readonly ExternalProviderAcceptanceProfile[] = Object.freeze([
  profile({
    domain: 'CLOUD_INFRASTRUCTURE',
    requiredCapabilities: [
      'PRIVATE_NETWORKING',
      'SERVICE_IDENTITY',
      'SECRET_MANAGER',
      'OBJECT_STORAGE',
      'IMMUTABLE_CONTAINER_DEPLOYMENT',
      'TLS_MTLS',
      'LOGGING',
      'MONITORING',
      'BACKUP',
      'FAILURE_DOMAIN_METADATA',
    ],
    requiredEvidenceClasses: COMMON_SECURITY,
    requiredHumanReviewerRole: 'OPERATIONS_REVIEWER',
    canonicalRegistry: 'PRODUCTION_INFRASTRUCTURE',
    dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA', 'PUBLIC_CHAIN_DATA'],
    notes: 'Reuses ProductionInfrastructureRegistry. Cloud adapters validate configuration without live credentials.',
  }),
  profile({
    domain: 'SECRET_MANAGER',
    requiredCapabilities: ['SECRET_REFERENCE', 'WORKLOAD_IDENTITY', 'ROTATION'],
    requiredEvidenceClasses: ['SECURITY_ASSESSMENT', 'KEY_MANAGEMENT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'SECURITY_REVIEWER',
    canonicalRegistry: 'PRODUCTION_INFRASTRUCTURE',
    dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA'],
    notes: 'Credentials remain SecretReference values from Chunk 66. No secret value in reports.',
  }),
  profile({
    domain: 'KMS',
    requiredCapabilities: ['GENERATE', 'SIGN', 'ROTATE', 'DISABLE', 'NON_EXPORTABLE'],
    requiredEvidenceClasses: ['KEY_MANAGEMENT', 'SECURITY_ASSESSMENT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'SECURITY_REVIEWER',
    canonicalRegistry: 'SECURITY_HSM',
    dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA'],
    notes: 'Reuses packages/security HsmKmsProvider. Software PQ is not hardware PQ.',
  }),
  profile({
    domain: 'HSM',
    requiredCapabilities: [
      'NON_EXPORTABLE_GENERATION',
      'SIGNING',
      'ATTESTATION',
      'KEY_ROTATION',
      'BACKUP_RECOVERY_MODEL',
      'SERVICE_AUTHENTICATION',
      'ALGORITHM_SUPPORT',
      'UPTIME_CONTINUITY',
    ],
    requiredEvidenceClasses: [
      'HSM_ATTESTATION',
      'KEY_MANAGEMENT',
      'SECURITY_ASSESSMENT',
      'SOC_ISO_OR_EQUIVALENT',
      'PENETRATION_TEST',
      'BUSINESS_CONTINUITY',
      'HUMAN_APPROVAL',
    ],
    requiredHumanReviewerRole: 'SECURITY_REVIEWER',
    canonicalRegistry: 'SECURITY_HSM',
    dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA', 'CUSTODY_METADATA'],
    notes: 'Local/sandbox HSM contract tests run in CI. Commercial HSM certification remains external and unfilled.',
  }),
  profile({
    domain: 'DATABASE',
    requiredCapabilities: ['TLS', 'BACKUP', 'PITR', 'REPLICATION', 'MONITORING', 'CREDENTIAL_ROTATION', 'FAILURE_DOMAINS'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'SECURITY_ASSESSMENT', 'BUSINESS_CONTINUITY', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'OPERATIONS_REVIEWER',
    canonicalRegistry: 'PRODUCTION_INFRASTRUCTURE',
    dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA', 'IDENTITY_DATA'],
    notes: 'Local WAL archive is not a managed-PITR claim. Do not claim managed PITR without provider evidence.',
  }),
  profile({
    domain: 'OBJECT_STORAGE',
    requiredCapabilities: ['ENCRYPTION', 'INTEGRITY_CHECK', 'RETENTION_POLICY', 'ACCESS_ISOLATION', 'BACKUP_RETRIEVAL'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'SECURITY_ASSESSMENT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'OPERATIONS_REVIEWER',
    canonicalRegistry: 'PRODUCTION_INFRASTRUCTURE',
    dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA', 'PUBLIC_CHAIN_DATA'],
    notes: 'Immutability/versioning is recorded only where the provider is configured to support it.',
  }),
  profile({
    domain: 'DNS',
    requiredCapabilities: ['RECORD_MANAGEMENT', 'ENVIRONMENT_BINDING'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'OPERATIONS_REVIEWER',
    canonicalRegistry: 'PRODUCTION_INFRASTRUCTURE',
    dataClasses: ['PUBLIC_CHAIN_DATA'],
    notes: 'Reuses Chunk 66 DnsConfiguration. Production domain is not required for local acceptance.',
  }),
  profile({
    domain: 'CERTIFICATE_MANAGER',
    requiredCapabilities: ['ISSUE', 'ROTATE', 'CHAIN_VERIFY', 'TLS_MTLS'],
    requiredEvidenceClasses: ['SECURITY_ASSESSMENT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'SECURITY_REVIEWER',
    canonicalRegistry: 'PRODUCTION_INFRASTRUCTURE',
    dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA'],
    notes: 'Reuses LocalCertificateManager. Custom TLS is not implemented.',
  }),
  profile({
    domain: 'ORACLE_DATA_SOURCE',
    requiredCapabilities: [
      'AUTHENTICATION',
      'SCHEMA',
      'UNIT_CONTRACT',
      'TIMESTAMP_BEHAVIOR',
      'AVAILABILITY',
      'SIGNING',
      'SOURCE_PROVENANCE',
      'SOURCE_INDEPENDENCE_METADATA',
      'RATE_CONSTRAINTS',
      'FAILURE_BEHAVIOR',
    ],
    requiredEvidenceClasses: [
      'SERVICE_CONTRACT',
      'DATA_LICENSE_AGREEMENT',
      'SECURITY_ASSESSMENT',
      'HUMAN_APPROVAL',
    ],
    requiredHumanReviewerRole: 'COMMERCIAL_REVIEWER',
    canonicalRegistry: 'ORACLE_PROVIDER',
    dataClasses: ['ORACLE_PUBLIC_DATA'],
    notes: 'Integrates Chunk 68. Technical API success does not prove legal data-use rights.',
  }),
  profile({
    domain: 'IDENTITY_KYC',
    requiredCapabilities: ['SANDBOX_IDENTITY_CHECK'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'LICENSE_REGISTRATION', 'DATA_PROCESSING_AGREEMENT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'COUNSEL_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['IDENTITY_DATA', 'KYC_DATA'],
    notes: 'Vendor KYC results are Kernel evidence inputs. KYC success cannot issue Execution Authority.',
  }),
  profile({
    domain: 'SANCTIONS_PEP',
    requiredCapabilities: ['SANDBOX_SCREEN'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'LICENSE_REGISTRATION', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'COUNSEL_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['IDENTITY_DATA'],
    notes: 'Integrates Chunk 69 sandbox. Not a guilt determination.',
  }),
  profile({
    domain: 'AML_TRANSACTION_MONITORING',
    requiredCapabilities: ['SANDBOX_MONITOR'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'LICENSE_REGISTRATION', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'COUNSEL_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['PAYMENT_DATA', 'IDENTITY_DATA'],
    notes: 'Vendor alerts remain evidence inputs to the Compliance Kernel.',
  }),
  profile({
    domain: 'TRAVEL_RULE',
    requiredCapabilities: ['SANDBOX_TRAVEL_RULE'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'LICENSE_REGISTRATION', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'COUNSEL_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['CUSTODY_METADATA', 'IDENTITY_DATA'],
    notes: 'Sandbox Travel Rule only. No live VASP network.',
  }),
  profile({
    domain: 'MARKET_SURVEILLANCE',
    requiredCapabilities: ['SANDBOX_SURVEILLANCE'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'SECURITY_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['PUBLIC_CHAIN_DATA'],
    notes: 'Alerts are case proposals, not legal guilt.',
  }),
  profile({
    domain: 'CASE_MANAGEMENT',
    requiredCapabilities: ['SANDBOX_CASE'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'DATA_PROCESSING_AGREEMENT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'OPERATIONS_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['IDENTITY_DATA', 'CONFIDENTIAL_OPERATIONS_DATA'],
    notes: 'Case records stay in the existing Kernel case fabric.',
  }),
  profile({
    domain: 'CUSTODY_PROVIDER',
    requiredCapabilities: [
      'VAULT_IDENTITY',
      'SIGNING_POLICY',
      'WITHDRAWAL_WORKFLOW',
      'IDEMPOTENCY',
      'SUBMISSION_AMBIGUITY',
      'AUDIT_REFERENCE_IDS',
      'RECONCILIATION',
    ],
    requiredEvidenceClasses: [
      'SERVICE_CONTRACT',
      'LICENSE_REGISTRATION',
      'HSM_ATTESTATION',
      'SECURITY_ASSESSMENT',
      'HUMAN_APPROVAL',
    ],
    requiredHumanReviewerRole: 'SECURITY_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['CUSTODY_METADATA'],
    notes: 'No live customer withdrawal in CI. Institutional HSM interface only.',
  }),
  profile({
    domain: 'BANKING_REFERENCE',
    requiredCapabilities: ['TECHNICAL_INTERFACE'],
    requiredEvidenceClasses: [
      'SERVICE_CONTRACT',
      'LICENSE_REGISTRATION',
      'JURISDICTION',
      'DATA_PROCESSING_AGREEMENT',
      'HUMAN_APPROVAL',
    ],
    requiredHumanReviewerRole: 'COUNSEL_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['PAYMENT_DATA', 'IDENTITY_DATA'],
    notes: 'Technical interface acceptance is distinct from bank agreement, regulatory approval, account opening, and money-transmitter licensing. Adapter cannot activate fiat.',
  }),
  profile({
    domain: 'PAYMENT_RAIL',
    requiredCapabilities: [
      'TECHNICAL_INTERFACE',
      'IDEMPOTENCY',
      'SUBMISSION_AMBIGUITY',
      'STATUS_NORMALIZATION',
      'WEBHOOK_SIGNATURE',
      'RECONCILIATION',
    ],
    requiredEvidenceClasses: [
      'SERVICE_CONTRACT',
      'LICENSE_REGISTRATION',
      'JURISDICTION',
      'SECURITY_ASSESSMENT',
      'HUMAN_APPROVAL',
    ],
    requiredHumanReviewerRole: 'COUNSEL_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['PAYMENT_DATA'],
    notes: 'Engineering rail class is not named-network membership. Chunk 151 candidates stay sandbox-only. Canonical RailAdapter remains packages/payments.',
  }),
  profile({
    domain: 'FX_LIQUIDITY',
    requiredCapabilities: ['TECHNICAL_INTERFACE', 'EXACT_RATIONAL_RATE', 'QUOTE_EXPIRY'],
    requiredEvidenceClasses: [
      'SERVICE_CONTRACT',
      'DATA_LICENSE_AGREEMENT',
      'SECURITY_ASSESSMENT',
      'HUMAN_APPROVAL',
    ],
    requiredHumanReviewerRole: 'COUNSEL_REVIEWER',
    canonicalRegistry: 'REGULATED_SERVICE',
    dataClasses: ['PAYMENT_DATA'],
    notes: 'Exact rational FX only. Unavailable or stale providers must not invent a rate. Not a live FX venue.',
  }),
  profile({
    domain: 'OTHER_GOVERNED_EXTERNAL_PROVIDER',
    requiredCapabilities: ['CONFIGURED_INTERFACE'],
    requiredEvidenceClasses: ['SERVICE_CONTRACT', 'SECURITY_ASSESSMENT', 'HUMAN_APPROVAL'],
    requiredHumanReviewerRole: 'OPERATIONS_REVIEWER',
    canonicalRegistry: null,
    dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA'],
    notes: 'Catch-all governed dependency. Does not create a second domain registry.',
  }),
]);

export function profileFor(domain: ProviderDomain): ExternalProviderAcceptanceProfile {
  const found = DOMAIN_PROFILES.find((row) => row.domain === domain);
  if (!found) {
    throw new TypeError(`unknown provider domain ${domain}`);
  }
  return found;
}
