/**
 * Wave 7 data-exposure audit catalog. Documents surfaces that must return
 * assertions or minimized fields instead of full underlying datasets.
 */
export type ExposureSurface =
  | 'API_RESPONSE'
  | 'BFF_ADAPTER'
  | 'DATABASE_QUERY'
  | 'FEDERATED_QUERY'
  | 'GRAPH_QUERY'
  | 'STRUCTURED_LOG'
  | 'EVIDENCE_OBJECT'
  | 'USAGE_RECEIPT'
  | 'POLICY_INPUT'
  | 'CHAIN_PAYLOAD';

export type ExposureRisk = 'HIGH' | 'MEDIUM' | 'LOW' | 'MITIGATED';

export type DataExposureAuditEntry = {
  readonly surface: ExposureSurface;
  readonly location: string;
  readonly risk: ExposureRisk;
  readonly overexposurePattern: string;
  readonly mitigation: string;
  readonly status: 'MITIGATED' | 'PARTIAL' | 'INTERFACE_ONLY' | 'AUDITED';
};

export const WAVE7_DATA_EXPOSURE_AUDIT: readonly DataExposureAuditEntry[] = Object.freeze([
  {
    surface: 'API_RESPONSE',
    location: 'services/api/src/consumer-*.ts',
    risk: 'HIGH',
    overexposurePattern: 'full vault payload or credential document in BFF DTO',
    mitigation: 'return PrivacyAssertion or MinimizedReadRequest fields only',
    status: 'PARTIAL',
  },
  {
    surface: 'BFF_ADAPTER',
    location: 'services/api/src/adapters/',
    risk: 'HIGH',
    overexposurePattern: 'pass-through of provider KYC payloads',
    mitigation: 'map to credentialStatus / thresholdSatisfied assertions',
    status: 'PARTIAL',
  },
  {
    surface: 'DATABASE_QUERY',
    location: 'packages/persistence/src/personal-data-vault/',
    risk: 'MEDIUM',
    overexposurePattern: 'SELECT * on ciphertext metadata joins',
    mitigation: 'column projection + purpose-scoped access broker',
    status: 'MITIGATED',
  },
  {
    surface: 'FEDERATED_QUERY',
    location: 'packages/economic-awareness-fabric/src/federation/',
    risk: 'HIGH',
    overexposurePattern: 'bulk observation export across providers',
    mitigation: 'VerifiedEconomicFact candidates without raw provider payloads',
    status: 'MITIGATED',
  },
  {
    surface: 'GRAPH_QUERY',
    location: 'packages/personal-economic-graph/src/',
    risk: 'MEDIUM',
    overexposurePattern: 'raw HIN or vault node contents in graph projection',
    mitigation: 'pseudonymous refs and commitment-only nodes',
    status: 'MITIGATED',
  },
  {
    surface: 'STRUCTURED_LOG',
    location: 'services/api/src/logging.ts',
    risk: 'HIGH',
    overexposurePattern: 'tokens, health fields, consent documents in log fields',
    mitigation: 'packages/security/src/safe-logging.ts redaction catalog',
    status: 'MITIGATED',
  },
  {
    surface: 'EVIDENCE_OBJECT',
    location: 'packages/sunrey-chain/src/evidence-commitments/',
    risk: 'HIGH',
    overexposurePattern: 'raw personal data in block or bundle payloads',
    mitigation: 'commitment-only payloads; scanForForbiddenBlockPayload',
    status: 'MITIGATED',
  },
  {
    surface: 'USAGE_RECEIPT',
    location: 'packages/clean-room/src/contribution.ts',
    risk: 'MEDIUM',
    overexposurePattern: 'row-level export in computation receipt',
    mitigation: 'ContributionComputationReference without plaintext rows',
    status: 'MITIGATED',
  },
  {
    surface: 'POLICY_INPUT',
    location: 'packages/consent/src/permit.ts',
    risk: 'MEDIUM',
    overexposurePattern: 'full consent grant document passed to policy engine',
    mitigation: 'purposeId + scopeCommitment + proofRef only',
    status: 'MITIGATED',
  },
  {
    surface: 'CHAIN_PAYLOAD',
    location: 'packages/sunrey-chain/src/protocol/',
    risk: 'HIGH',
    overexposurePattern: 'DOB, health, transcript on chain',
    mitigation: 'isCommitmentOnlyPayload + ADR-0030 off-chain-only raw data',
    status: 'MITIGATED',
  },
]);

export function highRiskSurfaces(): readonly DataExposureAuditEntry[] {
  return WAVE7_DATA_EXPOSURE_AUDIT.filter((entry) => entry.risk === 'HIGH');
}

export function surfacesNeedingHardening(): readonly DataExposureAuditEntry[] {
  return WAVE7_DATA_EXPOSURE_AUDIT.filter((entry) => entry.status === 'PARTIAL' || entry.status === 'INTERFACE_ONLY');
}
