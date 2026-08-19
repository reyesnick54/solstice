import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import {
  INFORMATION_RIGHT_CONTRIBUTION,
  type HinContributionFailure,
  type HumanContributionRecord,
  type HumanContributionRegistryPort,
  type InformationRightContributionEvidence,
} from './contract.ts';
import { assertPrivacySafeRegistryPayload } from './privacy.ts';

/**
 * Structural face of packages/human-economic-contribution
 * `HumanContributionRegistry` (Chunks 104-106). HIN must not import
 * that package's engine internals. After those chunks merge, pass the
 * canonical registry into {@link bindCanonicalHumanContributionRegistry}.
 */
export type CanonicalContributionRecord = {
  readonly contributionId: string;
  readonly status: string;
  readonly subjectRef: string;
  readonly contributionClass: string;
  readonly createdAt: UtcInstant;
};

export type CanonicalContributionRecorder = {
  record(input: {
    readonly subjectRef: string;
    readonly contributionClass: typeof INFORMATION_RIGHT_CONTRIBUTION;
    readonly sourceClass: 'HUMAN_INFORMATION_NETWORK';
    readonly eventReference: string;
    readonly measurementQuantity: bigint;
    readonly measurementUnit: 'CONSENT_SCOPED_INFORMATION_USE';
    readonly validFrom: UtcInstant;
    readonly jurisdiction: string;
    readonly createdAt: UtcInstant;
    readonly status: 'VERIFIED';
    readonly eligibilityState: 'NOT_SETTLEMENT_ELIGIBLE';
    readonly verificationQuality: 'VERIFIED';
    readonly evidenceReferences: readonly string[];
    readonly rightsReferences: readonly string[];
    readonly consentReferences: readonly string[];
    readonly purposeReferences: readonly string[];
    readonly usageReceiptReferences: readonly string[];
    readonly canonicalReferences: {
      readonly informationRightRefs: readonly string[];
      readonly consentGrantRefs: readonly string[];
      readonly usageReceiptRefs: readonly string[];
      readonly cleanRoomResultRefs: readonly string[];
    };
  }): Result<CanonicalContributionRecord, { readonly code: string; readonly message: string }>;
  get?(contributionId: string): CanonicalContributionRecord | undefined;
};

function hexRef(prefix: string, material: string): string {
  return `${prefix}${createHash('sha256').update(material).digest('hex').slice(0, 32)}`;
}

function mapFailure(code: string, message: string): HinContributionFailure {
  if (code === 'RAW_PERSONAL_DATA_FORBIDDEN' || code === 'RAW_PDV_CONTENT_FORBIDDEN' || code === 'RAW_CLEAN_ROOM_ROWS_FORBIDDEN') {
    return { code: 'RAW_PERSONAL_DATA_FORBIDDEN', message };
  }
  if (code === 'USAGE_RECEIPT_REQUIRED') {
    return { code: 'USAGE_DID_NOT_OCCUR', message };
  }
  if (code === 'INFORMATION_RIGHTS_REQUIRED') {
    return { code: 'RIGHT_MISSING', message };
  }
  if (code === 'MINT_AUTHORIZATION_FORBIDDEN' || code === 'ISSUANCE_QUANTITY_FORBIDDEN') {
    return { code: 'AUTOMATIC_MINT_FORBIDDEN', message };
  }
  return { code: 'EVIDENCE_INCOMPLETE', message };
}

export function bindCanonicalHumanContributionRegistry(
  canonical: CanonicalContributionRecorder,
): HumanContributionRegistryPort {
  const byReceipt = new Map<string, HumanContributionRecord>();
  const byId = new Map<string, HumanContributionRecord>();

  return {
    recordVerifiedContribution(
      evidence: InformationRightContributionEvidence,
      verifiedAt: UtcInstant,
    ): Result<HumanContributionRecord, HinContributionFailure> {
      const existing = byReceipt.get(evidence.usageReceiptId);
      if (existing) {
        return err({
          code: 'DUPLICATE_USAGE_RECEIPT',
          message: 'a usage receipt can create at most one verified contribution',
        });
      }
      const privacy = assertPrivacySafeRegistryPayload(evidence);
      if (!privacy.ok) {
        return privacy;
      }
      const recorded = canonical.record({
        subjectRef: hexRef('subj_', evidence.subjectPseudonymousRef),
        contributionClass: INFORMATION_RIGHT_CONTRIBUTION,
        sourceClass: 'HUMAN_INFORMATION_NETWORK',
        eventReference: hexRef('hevt_', evidence.usageReceiptId),
        measurementQuantity: 1n,
        measurementUnit: 'CONSENT_SCOPED_INFORMATION_USE',
        validFrom: evidence.occurredAt,
        jurisdiction: 'SIMULATION',
        createdAt: verifiedAt,
        status: 'VERIFIED',
        eligibilityState: 'NOT_SETTLEMENT_ELIGIBLE',
        verificationQuality: 'VERIFIED',
        evidenceReferences: [hexRef('hevr_', evidence.evidenceDigest)],
        rightsReferences: [hexRef('hir_', evidence.rightId)],
        consentReferences: [hexRef('cgr_', evidence.consentRef)],
        purposeReferences: [hexRef('pur_', evidence.purposeRef)],
        usageReceiptReferences: [hexRef('urc_', evidence.usageReceiptId)],
        canonicalReferences: {
          informationRightRefs: [hexRef('hir_', evidence.rightId)],
          consentGrantRefs: [hexRef('cgr_', evidence.consentRef)],
          usageReceiptRefs: [hexRef('urc_', evidence.usageReceiptId)],
          cleanRoomResultRefs: evidence.approvedComputationResultId
            ? [hexRef('crrf_', evidence.approvedComputationResultId)]
            : [],
        },
      });
      if (!recorded.ok) {
        return err(mapFailure(recorded.error.code, recorded.error.message));
      }
      const record: HumanContributionRecord = Object.freeze({
        contributionId: recorded.value.contributionId,
        contributionClass: INFORMATION_RIGHT_CONTRIBUTION,
        status: 'VERIFIED',
        evidence,
        verifiedAt,
        historicalRecordImmutable: true,
        automaticSunReyMint: false,
        rawPersonalDataOnRegistry: false,
      });
      byId.set(record.contributionId, record);
      byReceipt.set(evidence.usageReceiptId, record);
      return ok(record);
    },
    getById(contributionId: string): HumanContributionRecord | undefined {
      return byId.get(contributionId);
    },
    getByUsageReceiptId(usageReceiptId: string): HumanContributionRecord | undefined {
      return byReceipt.get(usageReceiptId);
    },
  };
}
