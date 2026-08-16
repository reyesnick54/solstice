export const EVIDENCE_KIND_SUNREY_CHAIN = 'SUNREY_CHAIN';

export const CHAIN_NETWORK_MODES = [
  'SIMULATION',
  'DEVELOPMENT',
  'TEST_NETWORK_PLACEHOLDER',
  'PRODUCTION_DISABLED',
] as const;
export type ChainNetworkMode = (typeof CHAIN_NETWORK_MODES)[number];

export const INITIAL_CHAIN_NETWORK_MODE: ChainNetworkMode = 'SIMULATION';

export const CHAIN_RECORD_TYPES = [
  'IDENTITY_REFERENCE',
  'CONSENT_RECEIPT',
  'CONSENT_REVOCATION',
  'ATTESTATION',
  'PROVENANCE',
  'POLICY_DECISION',
  'COMPUTATION_RECEIPT',
  'PROOF_OF_CONTRIBUTION',
  'DIGITAL_ASSET_SETTLEMENT',
  'EVIDENCE_ANCHOR',
] as const;
export type ChainRecordType = (typeof CHAIN_RECORD_TYPES)[number];

export const CHAIN_DATA_CLASSES = ['ON_CHAIN_SAFE', 'OFF_CHAIN_ONLY'] as const;
export type ChainDataClass = (typeof CHAIN_DATA_CLASSES)[number];

export const CHAIN_OPERATION_STATES = [
  'CREATED',
  'QUEUED',
  'SUBMITTED',
  'ACCEPTED',
  'PENDING_FINALITY',
  'FINALIZED',
  'REJECTED',
  'UNKNOWN',
  'REORG_OBSERVED',
  'FAILED',
] as const;
export type ChainOperationState = (typeof CHAIN_OPERATION_STATES)[number];

export const CHAIN_HEALTH_STATUSES = [
  'AVAILABLE',
  'DEGRADED',
  'UNAVAILABLE',
  'MAINTENANCE',
  'FINALITY_DELAYED',
] as const;
export type ChainHealthStatus = (typeof CHAIN_HEALTH_STATUSES)[number];

export const RECONCILIATION_OUTCOMES = [
  'MATCHED',
  'PENDING',
  'MISSING_CHAIN_RECORD',
  'MISSING_INTERNAL_RECORD',
  'HASH_MISMATCH',
  'REORG_OBSERVED',
  'SUBMISSION_UNKNOWN',
  'DUPLICATE_EXTERNAL',
  'INVESTIGATION_REQUIRED',
] as const;
export type ReconciliationOutcome = (typeof RECONCILIATION_OUTCOMES)[number];

export const SUBJECT_REFERENCE_KINDS = [
  'VERIFIED_SUBJECT_REFERENCE',
  'PSEUDONYMOUS_SUBJECT_REFERENCE',
  'SERVICE_REFERENCE',
  'LEGAL_ENTITY_REFERENCE',
] as const;
export type SubjectReferenceKind = (typeof SUBJECT_REFERENCE_KINDS)[number];

export const SOURCE_SUBSYSTEMS = [
  'consent',
  'identity',
  'clean-room',
  'information-market',
  'sunrey-coin',
  'evidence',
  'kernel',
  'regulatory-twin',
  'personal-data-vault',
] as const;
export type SourceSubsystem = (typeof SOURCE_SUBSYSTEMS)[number];

export const ON_CHAIN_SAFE_FIELDS = [
  'cryptographic hashes',
  'commitments',
  'pseudonymous references',
  'public protocol metadata',
  'consent receipt references',
  'revocation status references',
  'attestation references',
  'provenance commitments',
  'settlement references',
  'policy version references',
] as const;

export const OFF_CHAIN_ONLY_FIELDS = [
  'raw KYC data',
  'legal names',
  'raw transaction history',
  'bank coordinates',
  'PAN/CVV',
  'health records',
  'genetic data',
  'raw PDV payloads',
  'private communications',
  'precise personal behavioral histories',
  'cryptographic private keys',
] as const;

export const FORBIDDEN_PAYLOAD_KEYS = [
  'pan',
  'cvv',
  'legalName',
  'legal_name',
  'fullName',
  'rawPdv',
  'rawPayload',
  'plaintext',
  'healthRecord',
  'geneticData',
  'privateKey',
  'private_key',
  'seedPhrase',
  'bankAccount',
  'iban',
  'routingNumber',
  'ssn',
  'nationalId',
] as const;

export const ENGINEERING_FINALITY_POLICY = Object.freeze({
  label: 'ENGINEERING_FIXTURE',
  counselStatus: 'RESEARCH_REQUIRED',
  productionThresholdSelected: false,
  minimumConfirmations: 2,
  maxWaitBlocks: 16,
  manualReviewAfterBlocks: 8,
  requiredSettlementState: 'FINALIZED',
  acceptableHealth: ['AVAILABLE', 'DEGRADED', 'FINALITY_DELAYED'] as const,
});
