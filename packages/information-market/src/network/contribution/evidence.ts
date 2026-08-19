import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { HumanInformationNetworkEngine } from '../engine.ts';
import {
  INFORMATION_RIGHT_CONTRIBUTION,
  type HinContributionFailure,
  type InformationRightContributionEvidence,
} from './contract.ts';
import { evaluateHinContributionInvariants } from './invariants.ts';
import { contributionEvidenceDigest } from './registry.ts';
import { assertPrivacySafeRegistryPayload } from './privacy.ts';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function toInformationRightContributionEvidence(
  engine: HumanInformationNetworkEngine,
  receiptId: string,
): Result<InformationRightContributionEvidence, HinContributionFailure> {
  const checked = evaluateHinContributionInvariants(engine, receiptId);
  if (!checked.ok) {
    return checked;
  }
  const { receipt, approvedComputationHash, approvedComputationResultId } = checked.value;
  const right = engine.store.rights.get(receipt.rightId);
  const grant = right ? engine.store.grants.get(right.consentGrantId) : undefined;
  const subject = right ? engine.store.subjects.get(right.subjectId) : undefined;
  if (!right || !grant || !subject) {
    return err({
      code: 'RIGHT_MISSING',
      message: 'cannot normalize contribution evidence without subject, right, and consent',
    });
  }
  const draft: Omit<InformationRightContributionEvidence, 'evidenceDigest'> = {
    contributionClass: INFORMATION_RIGHT_CONTRIBUTION,
    subjectPseudonymousRef: subject.internalRef,
    descriptorId: right.descriptorId,
    rightId: right.rightId,
    consentRef: grant.consentHash,
    purposeRef: sha256(right.purpose),
    usageReceiptId: receipt.receiptId,
    usageReceiptHash: receipt.evidenceDigest,
    approvedComputationId: receipt.computationId,
    approvedComputationHash,
    approvedComputationResultId,
    settlementRef: receipt.settlementRef,
    occurredAt: receipt.occurredAt,
    rawPersonalData: false,
    mintRequested: false,
    unrestrictedIssuance: false,
    automaticSunReyMint: false,
  };
  const evidence: InformationRightContributionEvidence = Object.freeze({
    ...draft,
    evidenceDigest: contributionEvidenceDigest(draft),
  });
  const privacy = assertPrivacySafeRegistryPayload(evidence);
  if (!privacy.ok) {
    return privacy;
  }
  return ok(evidence);
}
