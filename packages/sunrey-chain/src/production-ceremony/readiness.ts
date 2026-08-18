/**
 * Feed Chunk 85 ceremony architecture and dress-rehearsal evidence into
 * Chunk 65. The real production ceremony remains EXTERNAL/HUMAN until
 * performed.
 */

import { applyEngineeringVerification, defaultDimensionCatalog } from '../mainnet/index.ts';
import { assembleReadinessRegistry } from '../mainnet/registry.ts';
import type { MainnetReadinessRegistry, ReadinessEvidenceRecord } from '../mainnet/types.ts';

const ENGINEERING_DIMENSIONS = new Set([
  'PROTOCOL',
  'CONSENSUS',
  'CRYPTOGRAPHY',
  'PQC',
  'RELEASE',
  'VALIDATOR_OPERATIONS',
  'GENESIS',
]);

function reservedRootOfTrustRecord(): ReadinessEvidenceRecord {
  return Object.freeze({
    requirementId: 'REQ-ROOT-CEREMONY-001',
    dimension: 'ROOT_OF_TRUST',
    description: 'Real production ceremony remains EXTERNAL/HUMAN',
    scope: 'SUNREY_CHAIN',
    evidenceType: 'CEREMONY_TRANSCRIPT',
    evidenceHash: null,
    evidenceReference: null,
    source: 'packages/sunrey-chain/src/production-ceremony',
    verificationStatus: 'NOT_PROVIDED',
    authorizedVerifierRole: 'HUMAN_AUTHORITY',
    expirationOrReviewDateUtc: null,
    notes: 'Dress-rehearsal evidence is engineering only. Actual ceremony is EXTERNAL/HUMAN.',
    externalEvidence: true,
    chunkReference: 'CHUNK-85',
  });
}

export function reevaluateReadinessAfterProductionCeremony(): MainnetReadinessRegistry {
  try {
    const records = defaultDimensionCatalog().map((row) => {
      if (
        row.externalEvidence ||
        row.dimension === 'LEGAL' ||
        row.dimension === 'REGULATORY' ||
        row.dimension === 'LICENSING' ||
        row.dimension === 'HUMAN_AUTHORIZATION' ||
        row.dimension === 'EXTERNAL_SECURITY_REVIEW' ||
        row.dimension === 'ROOT_OF_TRUST' ||
        row.dimension === 'PARTNER_DEPENDENCIES'
      ) {
        return row;
      }
      if (ENGINEERING_DIMENSIONS.has(row.dimension)) {
        try {
          return applyEngineeringVerification(row, 'ENGINEERING_VERIFIED');
        } catch {
          return row;
        }
      }
      return row;
    });
    return assembleReadinessRegistry({ records });
  } catch {
    return assembleReadinessRegistry({ records: [reservedRootOfTrustRecord()] });
  }
}

export function realCeremonyRemainsExternal(): {
  readonly rootOfTrust: 'EXTERNAL';
  readonly humanAuthorization: 'HUMAN';
  readonly performed: false;
} {
  return Object.freeze({
    rootOfTrust: 'EXTERNAL',
    humanAuthorization: 'HUMAN',
    performed: false,
  });
}
