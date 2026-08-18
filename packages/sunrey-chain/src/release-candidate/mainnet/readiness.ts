/**
 * Bind Mainnet RC evidence into Chunk 65 without treating
 * ENGINEERING_QUALIFIED as AUTHORIZED_CANDIDATE.
 */

import { freezeEvidence } from '../../mainnet/evidence.ts';
import type { ReadinessEvidenceRecord } from '../../mainnet/types.ts';
import { FIRST_MAINNET_RC_ID } from './types.ts';

export function consumeMainnetRc(input?: {
  readonly rcId?: string;
  readonly sourceCommit?: string;
  readonly qualificationDigest?: string;
  readonly status?: string;
}): {
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly qualificationDigest: string;
  readonly engineeringStatus: 'ENGINEERING_QUALIFIED' | 'AWAITING_EXTERNAL_EVIDENCE' | 'ENGINEERING_QUALIFICATION';
  readonly authorizedCandidate: false;
  readonly mainnetAuthorized: false;
  readonly externalApprovalsRemain: true;
  readonly notes: string;
} {
  const status = input?.status ?? 'AWAITING_EXTERNAL_EVIDENCE';
  const engineeringStatus =
    status === 'ENGINEERING_QUALIFIED'
      ? 'ENGINEERING_QUALIFIED'
      : status === 'ENGINEERING_QUALIFICATION'
        ? 'ENGINEERING_QUALIFICATION'
        : 'AWAITING_EXTERNAL_EVIDENCE';
  return Object.freeze({
    rcId: input?.rcId ?? FIRST_MAINNET_RC_ID,
    sourceCommit: input?.sourceCommit ?? 'linked-from-chunk-84',
    qualificationDigest: input?.qualificationDigest ?? 'pending-mainnet-rc',
    engineeringStatus,
    authorizedCandidate: false,
    mainnetAuthorized: false,
    externalApprovalsRemain: true,
    notes: 'Chunk 84 Mainnet RC is engineering qualification only. ENGINEERING_QUALIFIED is not AUTHORIZED_CANDIDATE. External/human evidence remains required.',
  });
}

export function mainnetRcReadinessRecords(): readonly ReadinessEvidenceRecord[] {
  const consumed = consumeMainnetRc();
  return Object.freeze([
    freezeEvidence({
      requirementId: 'REQ-MAINNET-RC-001',
      dimension: 'RELEASE',
      description: 'SunRey Mainnet RC freeze and engineering qualification evidence',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/release-candidate/mainnet',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: consumed.notes,
      externalEvidence: false,
      chunkReference: 'CHUNK-84',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: consumed.qualificationDigest,
      evidenceReference: `mainnet-rc:${consumed.rcId}`,
    }),
    freezeEvidence({
      requirementId: 'REQ-MAINNET-RC-002',
      dimension: 'HUMAN_AUTHORIZATION',
      description: 'Human release approval that Mainnet RC may become an authorized candidate',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'HUMAN_AUTHORIZATION',
      source: 'human-mainnet-rc-approval-slot',
      authorizedVerifierRole: 'HUMAN_AUTHORITY',
      expirationOrReviewDateUtc: null,
      notes: 'CI cannot synthesize human release approval. ENGINEERING_QUALIFIED is not AUTHORIZED_CANDIDATE.',
      externalEvidence: true,
      chunkReference: 'CHUNK-84',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
  ]);
}
