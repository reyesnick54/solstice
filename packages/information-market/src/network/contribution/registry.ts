import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { fingerprintEconomicEvent } from '../../../../human-economic-contribution/src/fingerprint.ts';
import {
  ENGINEERING_VERIFICATION_POLICY,
  HumanContributionVerificationEngine,
  bundleFromInformationRightEvidence,
  factsFromInformationRightEvidence,
} from '../../../../human-economic-contribution/src/verification/index.ts';
import {
  INFORMATION_RIGHT_CONTRIBUTION,
  type HinContributionFailure,
  type HumanContributionRecord,
  type HumanContributionRegistryPort,
  type InformationRightContributionEvidence,
} from './contract.ts';
import { assertPrivacySafeRegistryPayload } from './privacy.ts';

const verificationEngine = new HumanContributionVerificationEngine(ENGINEERING_VERIFICATION_POLICY);

function mapVerificationFailure(codes: readonly string[]): HinContributionFailure {
  if (codes.includes('REQUIRES_ADDITIONAL_EVIDENCE') || codes.includes('EVIDENCE_MISSING')) {
    return { code: 'REQUIRES_ADDITIONAL_EVIDENCE', message: codes.join(',') };
  }
  return {
    code: 'VERIFICATION_REJECTED',
    message: `Chunk 109 verification rejected the information-right contribution: ${codes.join(',')}`,
  };
}

export function evaluateHinContributionEvidence(
  evidence: InformationRightContributionEvidence,
): Result<{ readonly contributionId: string; readonly decision: 'VERIFIED' }, HinContributionFailure> {
  const bundle = bundleFromInformationRightEvidence(evidence);
  const fingerprint = fingerprintEconomicEvent({
    subjectRef: bundle.subjectRef,
    contributionClass: bundle.contributionClass,
    eventReference: bundle.eventReference,
    validFrom: bundle.measurementPeriod.start,
    validUntil: bundle.measurementPeriod.end,
    measurementQuantity: bundle.measurement.quantity,
    measurementUnit: bundle.measurementUnit,
    jurisdiction: bundle.jurisdiction,
    sourceClass: bundle.sourceClass,
  });
  const facts = factsFromInformationRightEvidence(evidence, bundle, {
    declaredFingerprint: fingerprint,
    expectedFingerprint: fingerprint,
  });
  const decision = verificationEngine.evaluate({ bundle, facts, fingerprint });
  if (decision.decision !== 'VERIFIED') {
    return err(mapVerificationFailure(decision.decisionCodes));
  }
  return ok({ contributionId: bundle.contributionId, decision: 'VERIFIED' });
}

function digestEvidence(evidence: InformationRightContributionEvidence): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contributionClass: evidence.contributionClass,
        subjectPseudonymousRef: evidence.subjectPseudonymousRef,
        descriptorId: evidence.descriptorId,
        rightId: evidence.rightId,
        consentRef: evidence.consentRef,
        purposeRef: evidence.purposeRef,
        usageReceiptId: evidence.usageReceiptId,
        usageReceiptHash: evidence.usageReceiptHash,
        approvedComputationId: evidence.approvedComputationId,
        approvedComputationHash: evidence.approvedComputationHash,
        approvedComputationResultId: evidence.approvedComputationResultId,
        settlementRef: evidence.settlementRef,
        occurredAt: evidence.occurredAt,
      }),
    )
    .digest('hex');
}

function evidenceComplete(evidence: InformationRightContributionEvidence): boolean {
  return (
    evidence.contributionClass === INFORMATION_RIGHT_CONTRIBUTION &&
    evidence.subjectPseudonymousRef.length > 0 &&
    evidence.descriptorId.length > 0 &&
    evidence.rightId.length > 0 &&
    evidence.consentRef.length > 0 &&
    evidence.purposeRef.length > 0 &&
    evidence.usageReceiptId.length > 0 &&
    evidence.usageReceiptHash.length > 0 &&
    evidence.approvedComputationId.length > 0 &&
    evidence.approvedComputationHash.length > 0 &&
    evidence.evidenceDigest.length > 0 &&
    evidence.rawPersonalData === false &&
    evidence.mintRequested === false &&
    evidence.unrestrictedIssuance === false &&
    evidence.automaticSunReyMint === false
  );
}

/**
 * Simulation binding of the Chunk 104-105 evidence contract.
 *
 * This is not a second Human Economic Contribution Registry package.
 * HIN depends on {@link HumanContributionRegistryPort}. The canonical
 * registry implements the same contract without importing the HIN
 * engine. Swap the binding; do not invert the dependency.
 */
export function createInProcessHumanContributionRegistry(): HumanContributionRegistryPort {
  const byId = new Map<string, HumanContributionRecord>();
  const byReceipt = new Map<string, HumanContributionRecord>();

  return {
    recordVerifiedContribution(
      evidence: InformationRightContributionEvidence,
      verifiedAt: UtcInstant,
    ): Result<HumanContributionRecord, HinContributionFailure> {
      if (!evidenceComplete(evidence)) {
        return err({
          code: 'EVIDENCE_INCOMPLETE',
          message: 'normalized contribution evidence is missing required privacy-safe references',
        });
      }
      if (evidence.automaticSunReyMint !== false || evidence.mintRequested !== false) {
        return err({
          code: 'AUTOMATIC_MINT_FORBIDDEN',
          message: 'verified information contributions do not mint SunRey; Chunk 71 remains the monetary authority',
        });
      }
      if (digestEvidence(evidence) !== evidence.evidenceDigest) {
        return err({
          code: 'EVIDENCE_HASH_TAMPERED',
          message: 'contribution evidence digest does not bind the normalized references',
        });
      }
      const existing = byReceipt.get(evidence.usageReceiptId);
      if (existing) {
        return err({
          code: 'DUPLICATE_USAGE_RECEIPT',
          message: 'a usage receipt can create at most one verified contribution',
        });
      }
      const verified = evaluateHinContributionEvidence(evidence);
      if (!verified.ok) {
        return verified;
      }
      const record: HumanContributionRecord = Object.freeze({
        contributionId: verified.value.contributionId,
        contributionClass: INFORMATION_RIGHT_CONTRIBUTION,
        status: 'VERIFIED',
        evidence,
        verifiedAt,
        historicalRecordImmutable: true,
        automaticSunReyMint: false,
        rawPersonalDataOnRegistry: false,
      });
      const privacy = assertPrivacySafeRegistryPayload(record);
      if (!privacy.ok) {
        return privacy;
      }
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

export function contributionEvidenceDigest(evidence: Omit<InformationRightContributionEvidence, 'evidenceDigest'>): string {
  return digestEvidence({ ...evidence, evidenceDigest: '' });
}
