/**
 * Chunk 77 treasury readiness evidence.
 *
 * Engineering implementation may be verified. Production limits,
 * governance approval, and human authorization remain NOT_PROVIDED.
 */

import { freezeEvidence } from '../../mainnet/evidence.ts';
import type { ReadinessEvidenceRecord } from '../../mainnet/types.ts';
import { verifyTreasury } from './auditor.ts';
import { developmentTreasuryPolicy } from './policy.ts';
import { PROTOCOL_RESERVE_CLASSES } from './types.ts';

export function protocolTreasuryReadinessRecords(): readonly ReadinessEvidenceRecord[] {
  const policy = developmentTreasuryPolicy();
  const verify = verifyTreasury();
  return Object.freeze([
    freezeEvidence({
      requirementId: 'REQ-TREASURY-001',
      dimension: 'GENESIS',
      description: 'Protocol treasury policy implementation',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/economics/treasury',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: `Policy ${policy.policyVersion}. Distinct from packages/treasury. Production treasury inactive.`,
      externalEvidence: false,
      chunkReference: 'CHUNK-77',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: null,
      evidenceReference: policy.policyVersion,
    }),
    freezeEvidence({
      requirementId: 'REQ-TREASURY-002',
      dimension: 'GENESIS',
      description: 'Reserve classifications',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/economics/treasury/types.ts',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: PROTOCOL_RESERVE_CLASSES.join(', '),
      externalEvidence: false,
      chunkReference: 'CHUNK-77',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: null,
      evidenceReference: 'protocol-reserve-classes',
    }),
    freezeEvidence({
      requirementId: 'REQ-TREASURY-003',
      dimension: 'GENESIS',
      description: 'Spending policy',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/economics/treasury/policy.ts',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'Per-transaction, per-recipient, per-reserve, per-cycle, and global cycle limits remain UNCONFIGURED.',
      externalEvidence: false,
      chunkReference: 'CHUNK-77',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: null,
      evidenceReference: 'treasury-spending-policy',
    }),
    freezeEvidence({
      requirementId: 'REQ-TREASURY-004',
      dimension: 'FORMAL_ASSURANCE',
      description: 'Formal PROTOCOL_TREASURY model result',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'FORMAL_MODEL',
      source: 'packages/sunrey-chain/src/formal',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'PROTOCOL_TREASURY is model-checked within stated bounds.',
      externalEvidence: false,
      chunkReference: 'CHUNK-77',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: null,
      evidenceReference: 'formal:PROTOCOL_TREASURY',
    }),
    freezeEvidence({
      requirementId: 'REQ-TREASURY-005',
      dimension: 'SECURITY_TESTING',
      description: 'Treasury stress result',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'SOFTWARE_TEST',
      source: 'packages/sunrey-chain/src/economics/treasury/stress.ts',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'Budget exhaustion, duplicate disbursement, unauthorized recipient, wrong asset, reservation race, fee collapse, and emergency mint refusal.',
      externalEvidence: false,
      chunkReference: 'CHUNK-77',
      verificationStatus: verify.stressHold ? 'ENGINEERING_VERIFIED' : 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: 'treasury-stress-catalog',
    }),
    freezeEvidence({
      requirementId: 'REQ-TREASURY-006',
      dimension: 'GENESIS',
      description: 'Production limits configured',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/economics/treasury/policy.ts',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'Production spending limits remain UNCONFIGURED.',
      externalEvidence: false,
      chunkReference: 'CHUNK-77',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
    freezeEvidence({
      requirementId: 'REQ-TREASURY-007',
      dimension: 'HUMAN_AUTHORIZATION',
      description: 'Governance approval of production treasury policy',
      scope: 'ALL',
      evidenceType: 'HUMAN_AUTHORIZATION',
      source: 'packages/sunrey-chain/src/governance',
      authorizedVerifierRole: 'HUMAN_AUTHORITY',
      expirationOrReviewDateUtc: null,
      notes: 'AI cannot approve. Production treasury remains inactive.',
      externalEvidence: true,
      chunkReference: 'CHUNK-77',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
    freezeEvidence({
      requirementId: 'REQ-TREASURY-008',
      dimension: 'HUMAN_AUTHORIZATION',
      description: 'Human authorization of production treasury activation',
      scope: 'ALL',
      evidenceType: 'HUMAN_AUTHORIZATION',
      source: 'packages/sunrey-chain/src/mainnet/authorization.ts',
      authorizedVerifierRole: 'HUMAN_AUTHORITY',
      expirationOrReviewDateUtc: null,
      notes: 'Root-of-trust / governance keys are required. Absent for production.',
      externalEvidence: true,
      chunkReference: 'CHUNK-77',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
  ]);
}

export function protocolTreasuryReadinessSummary() {
  const records = protocolTreasuryReadinessRecords();
  return Object.freeze({
    treasuryPolicy: 'ENGINEERING_VERIFIED',
    reserveClassifications: 'ENGINEERING_VERIFIED',
    spendingPolicy: 'ENGINEERING_VERIFIED_PRODUCTION_UNCONFIGURED',
    formalResult: 'ENGINEERING_VERIFIED_WITHIN_BOUNDS',
    stressResult: 'ENGINEERING_VERIFIED',
    productionLimitsConfigured: false,
    governanceApproval: 'INCOMPLETE',
    humanAuthorization: 'INCOMPLETE',
    productionTreasuryInactive: true,
    records: records.map((row) =>
      Object.freeze({
        requirementId: row.requirementId,
        verificationStatus: row.verificationStatus,
        notes: row.notes,
      }),
    ),
  });
}
