/**
 * Production-candidate settlement evaluation.
 *
 * Produces a candidate authorized quantity and STOPS.
 * Never mints, never mutates AssetSupplyBook, never issues Execution Authority.
 */

import { INFORMATION_RIGHT_REQUIRED_CLASSES } from '../../../../../human-economic-contribution/src/taxonomy.ts';

import { convertReferenceUnderCandidate } from './conversion.ts';
import { conversionValuesConfigured, validateConversionPolicyCandidate } from './validation.ts';
import {
  NO_PRODUCTION_ECONOMIC_MEANING,
  REHEARSAL_FIXTURE,
  conversionFailure,
  type ConversionCandidateResult,
  type ConversionCandidateInput,
  type SunReyProductionSettlementConversionPolicyCandidate,
} from './types.ts';

export type CandidateSettlementBook = {
  readonly settledContributionIds: Set<string>;
  readonly settledValuationIds: Set<string>;
  readonly settledAuthorizationIds: Set<string>;
  readonly issuedByClass: Map<string, bigint>;
  readonly issuedByEpoch: Map<string, bigint>;
  readonly issuedGlobal: { value: bigint };
};

export function emptyCandidateSettlementBook(): CandidateSettlementBook {
  return {
    settledContributionIds: new Set(),
    settledValuationIds: new Set(),
    settledAuthorizationIds: new Set(),
    issuedByClass: new Map(),
    issuedByEpoch: new Map(),
    issuedGlobal: { value: 0n },
  };
}

export type CandidateSupplyGuards = {
  readonly maximumSupply: bigint | null;
  readonly genesisSupply: bigint | null;
  readonly remainingPostGenesis: bigint | null;
};

const FORBIDDEN_ACTORS = ['AI', 'S3M', 'GROK', 'MODEL', 'MODEL_OUTPUT', 'AGENT', 'FINANCIAL_AGENT'] as const;

export function evaluateProductionCandidateConversion(input: {
  readonly contribution: ConversionCandidateInput;
  readonly policy: SunReyProductionSettlementConversionPolicyCandidate | null;
  readonly actor: string;
  readonly epochKey?: string;
  readonly authorizationId?: string;
  readonly expectedContributionId?: string;
  readonly expectedValuationId?: string;
  readonly expectedValuationPolicyVersion?: string;
  readonly book?: CandidateSettlementBook;
  readonly supplyGuards?: CandidateSupplyGuards;
  readonly extra?: Readonly<Record<string, unknown>>;
  readonly revaluationOfSettledValuationId?: string;
}): ConversionCandidateResult {
  if (input.actor === 'AI') {
    return conversionFailure('AI_CANNOT_AUTHORIZE_CONVERSION', 'AI cannot authorize settlement conversion');
  }
  if (input.actor === 'S3M') {
    return conversionFailure('S3M_CANNOT_AUTHORIZE_CONVERSION', 'S3M cannot authorize settlement conversion');
  }
  if (input.actor === 'GROK') {
    return conversionFailure('GROK_CANNOT_AUTHORIZE_CONVERSION', 'Grok cannot authorize settlement conversion');
  }
  if ((FORBIDDEN_ACTORS as readonly string[]).includes(input.actor)) {
    return conversionFailure('AI_CANNOT_AUTHORIZE_CONVERSION', `${input.actor} cannot authorize settlement conversion`);
  }
  if (input.extra && ('peveScore' in input.extra || 'peve' in input.extra)) {
    return conversionFailure('PEVE_CANNOT_BECOME_CONVERSION_INPUT', 'PEVE score cannot become conversion input');
  }
  if (input.contribution.peveScoreUsedAsValue !== false) {
    return conversionFailure('PEVE_CANNOT_BECOME_SUNREY', 'PEVE cannot become a SunRey quantity');
  }
  if (input.contribution.humanWorthScore !== false || (input.extra && 'humanWorthScore' in input.extra)) {
    return conversionFailure('HUMAN_WORTH_FORBIDDEN', 'human-worth scores are forbidden');
  }
  if (input.extra && ('race' in input.extra || 'religion' in input.extra || 'ethnicity' in input.extra)) {
    return conversionFailure('PROTECTED_TRAIT_FORBIDDEN', 'protected traits cannot enter conversion');
  }
  if (input.contribution.consentOnly) {
    return conversionFailure('HIN_CONSENT_ALONE_INSUFFICIENT', 'HIN consent alone cannot create issuance');
  }
  if (input.contribution.usageReceiptOnly) {
    return conversionFailure('USAGE_RECEIPT_ALONE_INSUFFICIENT', 'usage receipt alone cannot create issuance');
  }
  if (input.contribution.cleanRoomOnly) {
    return conversionFailure('CLEAN_ROOM_ALONE_INSUFFICIENT', 'clean-room result alone cannot create issuance');
  }
  if (input.contribution.informationAssetOnly) {
    return conversionFailure('INFORMATION_ASSET_ALONE_INSUFFICIENT', 'information asset alone cannot create issuance');
  }
  if (!input.policy) {
    return conversionFailure('CONVERSION_POLICY_REQUIRED', 'conversion policy is required');
  }
  const validated = validateConversionPolicyCandidate(input.policy);
  if (!validated.ok) {
    return validated;
  }
  if (!conversionValuesConfigured(input.policy)) {
    return conversionFailure('VALUES_UNCONFIGURED', 'conversion numeric values are unconfigured');
  }
  if (input.contribution.verificationState !== 'VERIFIED') {
    return conversionFailure('CONTRIBUTION_VERIFICATION_REQUIRED', 'contribution verification is required');
  }
  if (
    (INFORMATION_RIGHT_REQUIRED_CLASSES as readonly string[]).includes(input.contribution.contributionClass) &&
    !input.contribution.rightsEvidencePresent
  ) {
    return conversionFailure('RIGHTS_EVIDENCE_REQUIRED', 'Information Right contributions require rights evidence');
  }
  if (input.contribution.economicAssetVerificationState === 'CHAIN_ANCHORED_ONLY') {
    return conversionFailure(
      'CHAIN_ANCHOR_IS_NOT_ECONOMIC_VERIFICATION',
      'chain anchored is not economically verified',
    );
  }
  if (
    input.expectedContributionId &&
    input.expectedContributionId !== input.contribution.contributionId
  ) {
    return conversionFailure('CONTRIBUTION_MISMATCH', 'contribution identity does not match valuation');
  }
  if (input.expectedValuationId && input.expectedValuationId !== input.contribution.valuationId) {
    return conversionFailure('VALUATION_MISMATCH', 'valuation identity does not match authorization request');
  }
  if (
    input.expectedValuationPolicyVersion &&
    input.expectedValuationPolicyVersion !== input.contribution.valuationPolicyVersion
  ) {
    return conversionFailure('VALUATION_POLICY_VERSION_MISMATCH', 'valuation policy version mismatch');
  }
  if (input.contribution.referenceDenomination !== input.policy.inputReferenceDenomination) {
    return conversionFailure('DENOMINATION_MISMATCH', 'valuation denomination does not match conversion policy');
  }
  if (typeof input.contribution.referenceValue !== 'bigint') {
    return conversionFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'reference value must be bigint');
  }
  const book = input.book ?? emptyCandidateSettlementBook();
  if (book.settledContributionIds.has(input.contribution.contributionId)) {
    return conversionFailure('REPLAY_REJECTED', 'same contribution cannot settle twice');
  }
  if (book.settledValuationIds.has(input.contribution.valuationId)) {
    return conversionFailure('REPLAY_REJECTED', 'same valuation cannot settle twice');
  }
  const authorizationId = input.authorizationId ?? `hcesa.candidate.${input.contribution.contributionId}`;
  if (book.settledAuthorizationIds.has(authorizationId)) {
    return conversionFailure('REPLAY_REJECTED', 'same authorization cannot settle twice');
  }
  if (input.revaluationOfSettledValuationId && book.settledValuationIds.has(input.revaluationOfSettledValuationId)) {
    return conversionFailure('REVALUATION_DOES_NOT_REMINT', 'revaluation does not silently remint');
  }
  const quantity = convertReferenceUnderCandidate(input.contribution.referenceValue, input.policy);
  const perContribution = input.policy.perContributionCeiling.value!;
  if (quantity > perContribution) {
    return conversionFailure('PER_CONTRIBUTION_CAP', 'per-contribution ceiling exceeded');
  }
  const classIssued = book.issuedByClass.get(input.contribution.contributionClass) ?? 0n;
  if (classIssued + quantity > input.policy.perContributionClassCeiling.value!) {
    return conversionFailure('PER_CLASS_CAP', 'per-class ceiling exceeded');
  }
  const epochKey = input.epochKey ?? 'epoch.rehearsal';
  const epochIssued = book.issuedByEpoch.get(epochKey) ?? 0n;
  if (epochIssued + quantity > input.policy.perEpochCeiling.value!) {
    return conversionFailure('EPOCH_CAP', 'epoch ceiling exceeded');
  }
  if (book.issuedGlobal.value + quantity > input.policy.globalEpochCeiling.value!) {
    return conversionFailure('GLOBAL_CAP', 'global epoch ceiling exceeded');
  }
  if (input.supplyGuards?.remainingPostGenesis !== null && input.supplyGuards?.remainingPostGenesis !== undefined) {
    if (quantity > input.supplyGuards.remainingPostGenesis) {
      return conversionFailure('MAX_SUPPLY_GUARD', 'post-genesis issuance cannot exceed maximum supply');
    }
  }
  if (input.supplyGuards?.maximumSupply !== null && input.supplyGuards?.maximumSupply !== undefined) {
    const genesis = input.supplyGuards.genesisSupply ?? 0n;
    if (genesis + book.issuedGlobal.value + quantity > input.supplyGuards.maximumSupply) {
      return conversionFailure('MAX_SUPPLY_GUARD', 'issuance cannot exceed maximum supply');
    }
  }
  book.settledContributionIds.add(input.contribution.contributionId);
  book.settledValuationIds.add(input.contribution.valuationId);
  book.settledAuthorizationIds.add(authorizationId);
  book.issuedByClass.set(input.contribution.contributionClass, classIssued + quantity);
  book.issuedByEpoch.set(epochKey, epochIssued + quantity);
  book.issuedGlobal.value += quantity;
  return {
    ok: true,
    value: Object.freeze({
      authorizationId,
      contributionId: input.contribution.contributionId,
      fingerprint: input.contribution.fingerprint,
      valuationId: input.contribution.valuationId,
      conversionPolicyId: input.policy.policyId,
      conversionPolicyVersion: input.policy.version,
      referenceValue: input.contribution.referenceValue,
      referenceDenomination: input.contribution.referenceDenomination,
      authorizedSunReyQuantity: quantity,
      outputAsset: 'SUNREY_COIN',
      productionActivated: false,
      referenceValueEqualsSunReyByDefinition: false,
      fixture: input.policy.fixture,
      rehearsalOnly: true,
      rehearsalFixtureLabel: input.policy.fixture ? REHEARSAL_FIXTURE : null,
      economicMeaning: NO_PRODUCTION_ECONOMIC_MEANING,
      mints: false,
      mutatesSupplyBook: false,
    }),
  };
}
