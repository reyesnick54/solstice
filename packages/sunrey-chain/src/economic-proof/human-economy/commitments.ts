import { commitRightsDomain } from '../rights/commitments.ts';
import { HUMAN_ECONOMY_COMMITMENT_DOMAINS } from './taxonomy.ts';
import type { HumanEconomyConsentGrant } from './types.ts';
import type { HumanDataUsageReceipt } from './types.ts';

export function humanEconomyConsentCommitment(consent: HumanEconomyConsentGrant): string {
  return commitRightsDomain(HUMAN_ECONOMY_COMMITMENT_DOMAINS.HUMAN_CONSENT_GRANT, {
    schemaVersion: consent.schemaVersion,
    humanConsentGrantId: consent.humanConsentGrantId,
    baseConsentCommitment: consent.baseConsentGrant.consentGrantId,
    purposeCode: consent.purposeCode,
    consentVersion: consent.consentVersion,
    renewedFromConsentId: consent.renewedFromConsentId,
    recipientSystemRef: consent.recipientSystemRef,
    scopeLabels: [...consent.scopeLabels].sort().join(','),
    lifecycleState: consent.lifecycleState,
    authorizesMonetaryIssuance: consent.authorizesMonetaryIssuance,
    authorizesDatasetMonetization: consent.authorizesDatasetMonetization,
  });
}

export function humanDataUsageReceiptCommitment(receipt: HumanDataUsageReceipt): string {
  return commitRightsDomain(HUMAN_ECONOMY_COMMITMENT_DOMAINS.USAGE_RECEIPT, {
    schemaVersion: receipt.schemaVersion,
    receiptId: receipt.receiptId,
    humanConsentGrantId: receipt.humanConsentGrantId,
    rightsGrantId: receipt.rightsGrantId,
    consentGrantId: receipt.consentGrantId,
    purposeCode: receipt.purposeCode,
    purposeId: receipt.purposeId,
    serviceRef: receipt.serviceRef,
    occurredAt: receipt.occurredAt,
    computationQueryRef: receipt.computationQueryRef,
    resultEvidenceRef: receipt.resultEvidenceRef,
    policyVersion: receipt.policyVersion,
    rightsCommitmentDigest: receipt.rightsCommitmentDigest,
    rawSensitivePayload: receipt.rawSensitivePayload,
  });
}

export function serializedCommitmentExcludesSensitiveFields(serialized: string): boolean {
  const blocked = [
    'rawMedicalRecord',
    'rawGeneticData',
    'rawCommunications',
    'rawLocationHistory',
    'rawSocialGraph',
    'governmentId',
    'legalName',
    'email',
    'rawPsychologicalAssessment',
    'rawDnaSequence',
    'rawSensitivePayload',
  ];
  return blocked.every((field) => !serialized.includes(field) || serialized.includes(`"${field}":false`));
}
