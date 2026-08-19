import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { computationHash } from '../privacy.ts';
import { outputClassIsPersonWorthScore } from '../policy.ts';
import type { HumanInformationNetworkEngine } from '../engine.ts';
import type { HumanInformationUsageReceipt } from '../types.ts';
import type { HinContributionFailure } from './contract.ts';

export type HinContributionContext = {
  readonly receipt: HumanInformationUsageReceipt;
  readonly approvedComputationHash: string;
  readonly approvedComputationResultId: string | null;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function expectedReceiptDigest(receipt: HumanInformationUsageReceipt): string {
  return sha256(`${receipt.rightId}:${receipt.requesterId}:${receipt.computationId}`);
}

export function evaluateHinContributionInvariants(
  engine: HumanInformationNetworkEngine,
  receiptId: string,
): Result<HinContributionContext, HinContributionFailure> {
  const receipt = engine.store.receipts.get(receiptId);
  if (!receipt) {
    return err({
      code: 'USAGE_DID_NOT_OCCUR',
      message: 'a verified information contribution requires a realized usage receipt',
    });
  }
  const right = engine.store.rights.get(receipt.rightId);
  if (!right) {
    return err({ code: 'RIGHT_MISSING', message: 'usage is not bound to a stored information right' });
  }
  const grant = engine.store.grants.get(right.consentGrantId);
  if (!grant) {
    return err({ code: 'CONSENT_MISSING', message: 'usage is not bound to a stored consent grant' });
  }
  const purpose = engine.store.purposes.get(right.purposeGrantId);
  if (!purpose) {
    return err({ code: 'CONSENT_MISSING', message: 'usage is not bound to a stored purpose grant' });
  }
  const descriptor = engine.store.descriptors.get(right.descriptorId);
  if (!descriptor) {
    return err({ code: 'RIGHT_MISSING', message: 'right is not bound to a stored information descriptor' });
  }
  const permission = [...engine.store.permissions.values()].find((row) => row.rightId === right.rightId);
  if (!permission) {
    return err({
      code: 'PERMISSION_INACTIVE',
      message: 'an inactive permission cannot create a verified contribution',
    });
  }
  const revokedBeforeUse = [...engine.store.revocations.values()].some(
    (row) => row.rightId === right.rightId && Date.parse(row.revokedAt) <= Date.parse(receipt.occurredAt),
  );
  if (revokedBeforeUse) {
    return err({
      code: 'RIGHT_REVOKED_BEFORE_USE',
      message: 'revocation before use cannot create a verified contribution',
    });
  }
  if (permission.status !== 'ACTIVE' && right.status !== 'REVOKED') {
    return err({
      code: 'PERMISSION_INACTIVE',
      message: 'an inactive permission cannot create a verified contribution',
    });
  }
  if (Date.parse(right.expiresAt) <= Date.parse(receipt.occurredAt) || Date.parse(grant.expiresAt) <= Date.parse(receipt.occurredAt)) {
    return err({
      code: 'RIGHT_EXPIRED_BEFORE_USE',
      message: 'an expired right cannot create a verified contribution',
    });
  }
  if (
    descriptor.subjectId !== right.subjectId ||
    grant.subjectId !== right.subjectId ||
    permission.subjectId !== right.subjectId
  ) {
    return err({
      code: 'DESCRIPTOR_SUBJECT_MISMATCH',
      message: 'descriptor, right, consent, and permission must name the same subject',
    });
  }
  if (
    receipt.purpose !== right.purpose ||
    receipt.purpose !== grant.purpose ||
    receipt.purpose !== purpose.purpose ||
    receipt.purpose !== permission.purpose
  ) {
    return err({
      code: 'PURPOSE_MISMATCH',
      message: 'usage purpose does not match the bound consent, right, and permission',
    });
  }
  const computation = engine.store.computations.get(receipt.computationId);
  if (!computation || computation.allowListed !== true) {
    return err({
      code: 'COMPUTATION_NOT_APPROVED',
      message: 'usage is not bound to an allow-listed approved computation',
    });
  }
  if (!computation.allowedOutputClasses.includes(receipt.outputClass)) {
    return err({
      code: 'OUTPUT_CLASS_FORBIDDEN',
      message: 'usage output class is not approved for the computation',
    });
  }
  if (outputClassIsPersonWorthScore(receipt.outputClass, receipt.purpose)) {
    return err({
      code: 'OUTPUT_CLASS_FORBIDDEN',
      message: 'person-worth or social-credit outputs cannot become economic contributions',
    });
  }
  if (receipt.evidenceDigest !== expectedReceiptDigest(receipt)) {
    return err({
      code: 'EVIDENCE_HASH_TAMPERED',
      message: 'usage receipt evidence digest does not bind the stored use',
    });
  }
  const presented = engine.verifyConsentHash(grant.grantId, grant.consentHash);
  if (!presented.ok) {
    return err({
      code: 'EVIDENCE_HASH_TAMPERED',
      message: presented.error.message,
    });
  }
  if (receipt.settlementRef) {
    const instruction = [...engine.store.compensation.values()].find(
      (row) => row.settlementRef === receipt.settlementRef,
    );
    if (instruction && (instruction.mintRequested !== false || instruction.unrestrictedIssuance !== false)) {
      return err({
        code: 'HIN_COMPENSATION_CANNOT_MINT',
        message: 'HumanInformationCompensationInstruction remains mintRequested=false and unrestrictedIssuance=false',
      });
    }
  }
  const boundHash = computationHash({
    codeVersion: computation.codeVersion,
    artifactDigest: computation.artifactDigest,
    inputRightDescriptors: [right.descriptorId],
    privacyPolicyVersion: engine.policy.privacyBudgetVersion,
    outputPolicy: receipt.outputClass,
  });
  let resultId: string | null = null;
  if (right.processingClass === 'CLEAN_ROOM_COMPUTATION') {
    const job = [...engine.store.jobs.values()]
      .filter(
        (row) =>
          row.status === 'COMPLETED' &&
          row.approvedComputationId === computation.computationId &&
          row.inputRightIds.includes(right.rightId) &&
          row.requesterId === receipt.requesterId,
      )
      .at(-1);
    const result = job
      ? [...engine.store.results.values()].find((row) => row.computationRequestId === job.computationRequestId)
      : undefined;
    if (!job || !result || result.rawRows !== false) {
      return err({
        code: 'COMPUTATION_NOT_APPROVED',
        message: 'clean-room information use requires an approved completed result without source rows',
      });
    }
    resultId = result.resultId;
  }
  return ok({
    receipt,
    approvedComputationHash: boundHash,
    approvedComputationResultId: resultId,
  });
}
