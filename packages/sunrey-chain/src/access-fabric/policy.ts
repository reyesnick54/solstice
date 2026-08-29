import type { ChainRecordType } from '../taxonomy.ts';
import type { AccessWorkflowEvent, EvidenceQualityLevel, EvidenceSourceClass } from './types.ts';

export const ACCESS_FABRIC_OWNER = Object.freeze({
  owner: 'packages/sunrey-chain',
  capability: 'sunrey-access-fabric',
  access10Chunk: 'ACCESS-10',
  access11Chunk: 'ACCESS-11',
  path: 'packages/sunrey-chain/src/access-fabric',
});

export const ACCESS_FABRIC_INVARIANTS = Object.freeze({
  CHAIN_ANCHOR_IS_COMPLETION_EVIDENCE: true,
  CHAIN_ANCHOR_TRANSFERS_OWNERSHIP: false,
  ANCHOR_MINTS_SUNREY: false,
  ANCHOR_MINTS_MOONREY: false,
  RAW_PERSONAL_DATA_ON_CHAIN: false,
  PRODUCTION_ACTIVE: false,
  DIRECT_LEDGER_POST_FORBIDDEN: true,
  SECOND_ORACLE_NETWORK_FORBIDDEN: true,
  PROVIDER_SELF_REPORT_BLIND_TRUST_FORBIDDEN: true,
});

export const ACCESS_COMMITMENT_DOMAINS = Object.freeze({
  RESERVATION: 'access.fabric.reservation.v1',
  GRANT: 'access.fabric.grant.v1',
  SERVICE_STARTED: 'access.fabric.service-started.v1',
  ACCESS_ACTIVATED: 'access.fabric.activated.v1',
  USAGE_MEASURED: 'access.fabric.usage.v1',
  PARTIAL_USAGE: 'access.fabric.partial-usage.v1',
  CAPACITY_DELIVERED: 'access.fabric.capacity-delivered.v1',
  CAPACITY_NOT_DELIVERED: 'access.fabric.capacity-not-delivered.v1',
  SERVICE_COMPLETED: 'access.fabric.completed.v1',
  RETURN_COMPLETED: 'access.fabric.return.v1',
  OVERAGE: 'access.fabric.overage.v1',
  EARLY_TERMINATION: 'access.fabric.early-termination.v1',
  DISPUTE: 'access.fabric.dispute.v1',
  REFUND_ADJUSTMENT_PROPOSAL: 'access.fabric.refund-proposal.v1',
  USAGE_PROOF: 'access.fabric.usage-proof.v1',
  DELIVERY_CLAIM: 'access.fabric.delivery-claim.v1',
  IDEMPOTENCY: 'access.fabric.idempotency.v1',
} as const);

export const ACCESS_WORKFLOW_TO_CHAIN_RECORD = Object.freeze({
  SERVICE_STARTED: 'EVIDENCE_ANCHOR',
  ACCESS_ACTIVATED: 'EVIDENCE_ANCHOR',
  USAGE_MEASURED: 'COMPUTATION_RECEIPT',
  PARTIAL_USAGE: 'COMPUTATION_RECEIPT',
  CAPACITY_DELIVERED: 'EVIDENCE_ANCHOR',
  CAPACITY_NOT_DELIVERED: 'EVIDENCE_ANCHOR',
  SERVICE_COMPLETED: 'EVIDENCE_ANCHOR',
  RETURN_COMPLETED: 'EVIDENCE_ANCHOR',
  OVERAGE: 'EVIDENCE_ANCHOR',
  EARLY_TERMINATION: 'EVIDENCE_ANCHOR',
  DISPUTE: 'EVIDENCE_ANCHOR',
  REFUND_ADJUSTMENT_PROPOSAL: 'EVIDENCE_ANCHOR',
} as const satisfies Record<AccessWorkflowEvent, ChainRecordType>);

export const ACCESS_FORBIDDEN_CHAIN_KEYS = Object.freeze([
  'legalName',
  'email',
  'phone',
  'address',
  'ssn',
  'nationalId',
  'kyc',
  'kycPayload',
  'rawPayload',
  'privateKey',
  'apiKey',
  'password',
  'licensePlate',
  'roomNumber',
  'gpsCoordinates',
  'deliveryAddress',
  'customerName',
]);

/** Domains where independent oracle evidence is required for settlement-grade proofs. */
export const ORACLE_REQUIRED_DOMAINS = new Set(['COMPUTE', 'ENERGY', 'VEHICLE_RENTAL']);

export const HIGH_VALUE_MINOR_UNITS = 10_000n;

const SOURCE_TO_QUALITY: Record<EvidenceSourceClass, EvidenceQualityLevel> = {
  ORACLE_NETWORK: 'INDEPENDENT_ORACLE',
  CORROBORATED_INDEPENDENT: 'CORROBORATED',
  PROVIDER_ATTESTED: 'PROVIDER_ATTESTED',
  PROVIDER_SELF_REPORT: 'SELF_REPORT_UNVERIFIED',
};

export function evidenceQualityForSource(sourceClass: EvidenceSourceClass): EvidenceQualityLevel {
  return SOURCE_TO_QUALITY[sourceClass];
}

export function qualityMeetsMinimum(
  actual: EvidenceQualityLevel,
  required: EvidenceQualityLevel,
): boolean {
  const rank: Record<EvidenceQualityLevel, number> = {
    SELF_REPORT_UNVERIFIED: 0,
    PROVIDER_ATTESTED: 1,
    CORROBORATED: 2,
    INDEPENDENT_ORACLE: 3,
  };
  return rank[actual] >= rank[required];
}

export const ALLOWED_STATE_TRANSITIONS: Readonly<
  Record<AccessWorkflowEvent, readonly import('./types.ts').AccessSessionStatus[]>
> = Object.freeze({
  SERVICE_STARTED: ['RESERVED', 'ACTIVATED'],
  ACCESS_ACTIVATED: ['RESERVED'],
  USAGE_MEASURED: ['ACTIVATED', 'IN_USE'],
  PARTIAL_USAGE: ['ACTIVATED', 'IN_USE'],
  CAPACITY_DELIVERED: ['ACTIVATED', 'IN_USE'],
  CAPACITY_NOT_DELIVERED: ['ACTIVATED', 'IN_USE'],
  SERVICE_COMPLETED: ['IN_USE', 'COMPLETING'],
  RETURN_COMPLETED: ['IN_USE', 'COMPLETING'],
  OVERAGE: ['IN_USE', 'COMPLETING', 'COMPLETED'],
  EARLY_TERMINATION: ['ACTIVATED', 'IN_USE', 'COMPLETING'],
  DISPUTE: ['ACTIVATED', 'IN_USE', 'COMPLETING', 'COMPLETED'],
  REFUND_ADJUSTMENT_PROPOSAL: ['COMPLETED', 'DISPUTED', 'TERMINATED'],
});

export function nextStatusAfterEvent(
  event: AccessWorkflowEvent,
  current: import('./types.ts').AccessSessionStatus,
): import('./types.ts').AccessSessionStatus | null {
  switch (event) {
    case 'ACCESS_ACTIVATED':
      return 'ACTIVATED';
    case 'SERVICE_STARTED':
      return current === 'RESERVED' ? 'ACTIVATED' : 'IN_USE';
    case 'USAGE_MEASURED':
    case 'PARTIAL_USAGE':
    case 'CAPACITY_DELIVERED':
    case 'CAPACITY_NOT_DELIVERED':
      return 'IN_USE';
    case 'SERVICE_COMPLETED':
    case 'RETURN_COMPLETED':
      return 'COMPLETED';
    case 'OVERAGE':
      return current === 'COMPLETED' ? 'COMPLETED' : 'COMPLETING';
    case 'EARLY_TERMINATION':
      return 'TERMINATED';
    case 'DISPUTE':
      return 'DISPUTED';
    case 'REFUND_ADJUSTMENT_PROPOSAL':
      return current;
    default: {
      const _never: never = event;
      return _never;
    }
  }
}
