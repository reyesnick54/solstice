import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ConsentGrantId, PurposeAuthorizationId, RightsGrantId } from '../rights/ids.ts';
import { rightsCommitmentDigestFor } from '../rights/evaluation.ts';
import type { RightsEvaluationAllow } from '../rights/types.ts';
import { humanDataUsageReceiptCommitment } from './commitments.ts';
import { newHumanDataUsageReceiptId } from './ids.ts';
import type { HumanEconomyConsentGrant, HumanDataUsageReceipt } from './types.ts';
import { HUMAN_ECONOMY_SCHEMA_VERSION } from './taxonomy.ts';
import type { HumanEconomyPurposeCode } from './taxonomy.ts';

export type BuildUsageReceiptInput = {
  readonly seed: string;
  readonly humanConsent: HumanEconomyConsentGrant;
  readonly rightsGrantId: RightsGrantId;
  readonly serviceRef: string;
  readonly occurredAt: UtcInstant;
  readonly computationQueryRef: string;
  readonly resultEvidenceRef: string;
  readonly policyVersion: string;
  readonly rightsEvaluation: RightsEvaluationAllow;
};

export function buildHumanDataUsageReceipt(input: BuildUsageReceiptInput): HumanDataUsageReceipt {
  const purposeCode = input.humanConsent.purposeCode;
  const purposeId = input.rightsEvaluation.reliedUpon.purposeId;

  const receipt: HumanDataUsageReceipt = Object.freeze({
    schemaVersion: HUMAN_ECONOMY_SCHEMA_VERSION,
    receiptId: newHumanDataUsageReceiptId(input.seed),
    humanConsentGrantId: input.humanConsent.humanConsentGrantId,
    rightsGrantId: input.rightsGrantId,
    consentGrantId: input.humanConsent.baseConsentGrant.consentGrantId,
    purposeCode,
    purposeId,
    serviceRef: input.serviceRef,
    occurredAt: input.occurredAt,
    computationQueryRef: input.computationQueryRef,
    resultEvidenceRef: input.resultEvidenceRef,
    policyVersion: input.policyVersion,
    rightsCommitmentDigest: rightsCommitmentDigestFor(input.rightsEvaluation),
    rawSensitivePayload: false,
  });

  return receipt;
}

export function usageReceiptExcludesRawPayload(receipt: HumanDataUsageReceipt): boolean {
  const serialized = JSON.stringify(receipt);
  return receipt.rawSensitivePayload === false
    && !serialized.includes('rawMedicalRecord')
    && !serialized.includes('rawGeneticData')
    && !serialized.includes('rawCommunications');
}

export function usageReceiptCommitmentDigest(receipt: HumanDataUsageReceipt): string {
  return humanDataUsageReceiptCommitment(receipt);
}

export function receiptBindsAuthorization(
  receipt: HumanDataUsageReceipt,
  consentGrantId: ConsentGrantId,
  purposeCode: HumanEconomyPurposeCode,
  purposeId: PurposeAuthorizationId,
): boolean {
  return receipt.consentGrantId === consentGrantId
    && receipt.purposeCode === purposeCode
    && receipt.purposeId === purposeId;
}
