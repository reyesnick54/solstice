/**
 * Wave 6 — build verified contribution input and valuation receipt.
 */

import { sha256Canonical } from '../ids.ts';
import type { HumanContributionRegistryRecord } from '../types.ts';
import { asVerifiedHumanEconomicContribution } from '../valuation/contribution.ts';
import type { HumanContributionValuationResult } from '../valuation/types.ts';
import type {
  HumanEconomicValuationReceipt,
  HumanEconomicValuationResult,
  VerifiedHumanEconomicContributionInput,
} from './types.ts';
import { WAVE6_PEVE_RECEIPT_ID, WAVE6_PEVE_RECEIPT_SCHEMA_VERSION } from './types.ts';

export function buildVerifiedHumanEconomicContributionInput(input: {
  readonly registryRecord: HumanContributionRegistryRecord;
  readonly humanEconomicClaimId: string;
  readonly canonicalEventId: string;
  readonly verificationReceiptRef: string;
  readonly identityAssuranceLevel: VerifiedHumanEconomicContributionInput['identityAssuranceLevel'];
  readonly evidenceProofRefs: readonly string[];
  readonly rightsProofRefs: readonly string[];
  readonly consentProofRefs: readonly string[];
  readonly policyProofRefs: readonly string[];
  readonly authorizedScope: string;
  readonly uniquenessStatus: VerifiedHumanEconomicContributionInput['uniquenessStatus'];
  readonly methodologyId: VerifiedHumanEconomicContributionInput['methodologyId'];
  readonly methodologyVersion: VerifiedHumanEconomicContributionInput['methodologyVersion'];
}): VerifiedHumanEconomicContributionInput {
  const contribution = asVerifiedHumanEconomicContribution(input.registryRecord);
  return Object.freeze({
    contribution,
    humanEconomicClaimId: input.humanEconomicClaimId,
    canonicalEventId: input.canonicalEventId,
    verificationReceiptRef: input.verificationReceiptRef,
    identityAssuranceLevel: input.identityAssuranceLevel,
    evidenceProofRefs: Object.freeze([...input.evidenceProofRefs]),
    rightsProofRefs: Object.freeze([...input.rightsProofRefs]),
    consentProofRefs: Object.freeze([...input.consentProofRefs]),
    policyProofRefs: Object.freeze([...input.policyProofRefs]),
    contributionClass: input.registryRecord.contributionClass,
    authorizedScope: input.authorizedScope,
    uniquenessStatus: input.uniquenessStatus,
    methodologyId: input.methodologyId,
    methodologyVersion: input.methodologyVersion,
    containsRawPersonalData: false,
    humanWorthAssigned: false,
    humanWorthScore: false,
    peveScoreUsedAsValue: false,
    sunReyQuantity: null,
  });
}

export function authorizedInputsDigest(input: VerifiedHumanEconomicContributionInput): string {
  return sha256Canonical(
    JSON.stringify({
      contributionId: input.contribution.contributionId,
      contributionFingerprint: input.contribution.contributionFingerprint,
      humanEconomicClaimId: input.humanEconomicClaimId,
      canonicalEventId: input.canonicalEventId,
      verificationReceiptRef: input.verificationReceiptRef,
      identityAssuranceLevel: input.identityAssuranceLevel,
      evidenceProofRefs: input.evidenceProofRefs,
      rightsProofRefs: input.rightsProofRefs,
      consentProofRefs: input.consentProofRefs,
      policyProofRefs: input.policyProofRefs,
      authorizedScope: input.authorizedScope,
      uniquenessStatus: input.uniquenessStatus,
      methodologyId: input.methodologyId,
      methodologyVersion: input.methodologyVersion,
    }),
  );
}

export function buildHumanEconomicValuationReceipt(input: {
  readonly valuationInput: VerifiedHumanEconomicContributionInput;
  readonly valuationResult: HumanEconomicValuationResult;
  readonly engineResult: HumanContributionValuationResult;
  readonly policyReference: string;
}): HumanEconomicValuationReceipt {
  const authorizedDigest = authorizedInputsDigest(input.valuationInput);
  const resultCommitment = sha256Canonical(
    JSON.stringify({
      receiptSchema: WAVE6_PEVE_RECEIPT_ID,
      valuationId: input.valuationResult.valuationId,
      valuationDigest: input.valuationResult.valuationDigest,
      finalReferenceValue: input.valuationResult.finalReferenceValue?.toString() ?? null,
      methodologyId: input.valuationResult.methodologyId,
      methodologyVersion: input.valuationResult.methodologyVersion,
      authorizedInputsDigest: authorizedDigest,
      policyReference: input.policyReference,
    }),
  );
  return Object.freeze({
    schemaVersion: WAVE6_PEVE_RECEIPT_SCHEMA_VERSION,
    receiptId: `peve-receipt.${input.valuationResult.valuationId}`,
    valuationId: input.valuationResult.valuationId,
    subjectPseudonymRef: input.valuationInput.contribution.subjectRef,
    contributionId: input.valuationResult.contributionId,
    humanEconomicClaimId: input.valuationInput.humanEconomicClaimId,
    contributionClass: input.valuationResult.contributionClass,
    methodologyId: input.valuationResult.methodologyId,
    methodologyVersion: input.valuationResult.methodologyVersion,
    authorizedInputsDigest: authorizedDigest,
    verificationReceiptRef: input.valuationInput.verificationReceiptRef,
    verificationReferences: Object.freeze([
      input.valuationInput.verificationReceiptRef,
      ...input.valuationInput.evidenceProofRefs,
    ]),
    valuationResult: input.valuationResult.finalReferenceValue,
    referenceDenomination: input.valuationResult.referenceDenomination,
    policyReference: input.policyReference,
    resultCommitment,
    environmentStatus: 'SIMULATION',
    humanWorthAssigned: false,
    humanWorthScore: false,
    peveScoreUsedAsValue: false,
    sunReyQuantity: null,
  });
}

export function wrapEngineResult(input: {
  readonly valuationInput: VerifiedHumanEconomicContributionInput;
  readonly engineResult: HumanContributionValuationResult;
}): HumanEconomicValuationResult {
  const state =
    input.engineResult.state === 'VALUED_SIMULATION'
      ? 'VALUED_SIMULATION'
      : input.engineResult.state === 'VALUATION_REJECTED'
        ? 'VALUATION_REJECTED'
        : 'VALUATION_REVIEW_REQUIRED';
  return Object.freeze({
    schemaVersion: WAVE6_PEVE_RECEIPT_SCHEMA_VERSION,
    valuationId: input.engineResult.valuationId,
    contributionId: input.engineResult.contributionId,
    contributionFingerprint: input.engineResult.contributionFingerprint,
    humanEconomicClaimId: input.valuationInput.humanEconomicClaimId,
    contributionClass: input.engineResult.contributionClass,
    methodologyId: input.valuationInput.methodologyId,
    methodologyVersion: input.valuationInput.methodologyVersion,
    finalReferenceValue: input.engineResult.finalReferenceValue,
    referenceDenomination: input.engineResult.referenceDenomination,
    valuationDigest: input.engineResult.valuationDigest,
    valuationTimestamp: input.engineResult.valuationTimestamp,
    state,
    engineResult: input.engineResult,
    humanWorthAssigned: false,
    humanWorthScore: false,
    peveScoreUsedAsValue: false,
    peveUsedAsTokenFormula: false,
    sunReyQuantity: null,
    setsExchangePrice: false,
    mintsSunRey: false,
    productionActivated: false,
  });
}
