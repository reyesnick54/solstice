/**
 * Bind economic RC evidence into Chunk 65 without treating it as
 * mainnet authorization.
 */

import { freezeEvidence } from '../../mainnet/evidence.ts';
import type { ReadinessEvidenceRecord } from '../../mainnet/types.ts';
import { freezeEconomicPolicies } from './freeze.ts';
import { FIRST_ECONOMIC_RC_ID } from './types.ts';

export function consumeEconomicRc(input?: {
  readonly rcId?: string;
  readonly sourceCommit?: string;
  readonly qualificationDigest?: string;
  readonly root?: string;
}): {
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly qualificationDigest: string;
  readonly engineeringStatus: 'ENGINEERING_VERIFIED';
  readonly mainnetAuthorized: false;
  readonly externalApprovalsRemain: true;
  readonly notes: string;
} {
  const root = input?.root ?? process.cwd();
  const policy = freezeEconomicPolicies(root);
  return Object.freeze({
    rcId: input?.rcId ?? FIRST_ECONOMIC_RC_ID,
    sourceCommit: input?.sourceCommit ?? 'linked-from-chunk-78',
    qualificationDigest: input?.qualificationDigest ?? policy.combinedHash,
    engineeringStatus: 'ENGINEERING_VERIFIED',
    mainnetAuthorized: false,
    externalApprovalsRemain: true,
    notes: 'Chunk 78 economic RC is engineering qualification only. External/human approvals remain according to actual evidence. This is not mainnet authorization. Qualification digest binds the canonical Chunk 76/77 policy freeze when a signed bundle is not supplied.',
  });
}

export function economicRcReadinessRecords(): readonly ReadinessEvidenceRecord[] {
  const consumed = consumeEconomicRc();
  return Object.freeze([
    freezeEvidence({
      requirementId: 'REQ-ECON-RC-001',
      dimension: 'RELEASE',
      description: 'SunRey economic testnet RC freeze and qualification evidence',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/release-candidate/economic',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: consumed.notes,
      externalEvidence: false,
      chunkReference: 'CHUNK-78',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: consumed.qualificationDigest,
      evidenceReference: `economic-rc:${consumed.rcId}`,
    }),
    freezeEvidence({
      requirementId: 'REQ-ECON-RC-002',
      dimension: 'HUMAN_AUTHORIZATION',
      description: 'External/human approval that economic RC may inform production activation',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'HUMAN_AUTHORIZATION',
      source: 'human-economic-rc-approval-slot',
      authorizedVerifierRole: 'HUMAN_AUTHORITY',
      expirationOrReviewDateUtc: null,
      notes: 'Human and external approvals remain unfilled. Engineering qualification is not mainnet authorization.',
      externalEvidence: true,
      chunkReference: 'CHUNK-78',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
  ]);
}
