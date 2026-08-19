/**
 * V2 MoonRey productive monetary evidence.
 *
 * Extends the Chunk 71 MoonRey evidence class. Does not create a
 * competing mint or evidence architecture. No raw provider payloads.
 */

import type { MoonReyProductiveEvidence } from '../../../economics/types.ts';
import type { MoonReyIssuanceReceipt } from '../../issuance.ts';
import { GOVERNED_VALUE_SIMULATION_PATH_CLASS } from '../../types.ts';
import type { MoonReyProductiveSettlementAuthorization, ProductiveValueResult } from './types.ts';

export type MoonReyGovernedValueEvidence = MoonReyProductiveEvidence & {
  readonly evidencePath: 'GOVERNED_VALUE_SIMULATION_V2';
  readonly schemaVersion: 2;
  readonly eventId: string;
  readonly eventFingerprint: string;
  readonly attributionDecisionId: string;
  readonly normalizationReceiptId: string;
  readonly productiveValueId: string;
  readonly productiveValueDigest: string;
  readonly valueFunctionPolicyId: string;
  readonly valueFunctionPolicyVersion: string;
  readonly conversionPolicyId: string;
  readonly conversionPolicyVersion: string;
  readonly settlementAuthorizationId: string;
  readonly productiveValueQuantity: bigint;
  readonly productiveValueUnit: 'GPUV';
  readonly authorizedMoonReyQuantity: bigint;
  readonly productiveValueAloneInsufficient: true;
  readonly gpuvEqualsMoonReyByDefinition: false;
  readonly rawProviderPayload: false;
};

export function toGovernedValueMonetaryEvidence(
  authorization: MoonReyProductiveSettlementAuthorization,
): MoonReyGovernedValueEvidence {
  return Object.freeze({
    evidenceClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    evidencePath: 'GOVERNED_VALUE_SIMULATION_V2',
    schemaVersion: 2,
    contributionId: authorization.contributionId,
    fingerprint: authorization.contributionFingerprint,
    authorizationId: authorization.authorizationId,
    policyVersion: authorization.conversionPolicyVersion,
    moonreyIssuanceAuthorizationRequired: true,
    oracleObservationAloneInsufficient: true,
    verifiedFactAloneInsufficient: true,
    eventId: authorization.eventId,
    eventFingerprint: authorization.eventFingerprint,
    attributionDecisionId: authorization.attributionDecisionId,
    normalizationReceiptId: authorization.normalizationReceiptId,
    productiveValueId: authorization.productiveValueId,
    productiveValueDigest: authorization.productiveValueDigest,
    valueFunctionPolicyId: authorization.productiveValuePolicyId,
    valueFunctionPolicyVersion: String(authorization.productiveValuePolicyVersion),
    conversionPolicyId: authorization.conversionPolicyId,
    conversionPolicyVersion: authorization.conversionPolicyVersion,
    settlementAuthorizationId: authorization.authorizationId,
    productiveValueQuantity: authorization.productiveValueQuantity,
    productiveValueUnit: 'GPUV',
    authorizedMoonReyQuantity: authorization.authorizedMoonReyQuantity,
    productiveValueAloneInsufficient: true,
    gpuvEqualsMoonReyByDefinition: false,
    rawProviderPayload: false,
  });
}

export function finalizeGovernedValueReceipt(input: {
  readonly authorization: MoonReyProductiveSettlementAuthorization;
  readonly valueResult: ProductiveValueResult;
  readonly recipient: string;
  readonly category: MoonReyIssuanceReceipt['category'];
  readonly inputQuantity: bigint;
  readonly inputUnit: string;
  readonly monetaryPolicyVersion: string;
  readonly oracleFacts: readonly string[];
  readonly blockHeight: number;
  readonly blockId: string;
}): MoonReyIssuanceReceipt {
  return Object.freeze({
    schemaVersion: 1,
    issuanceId: `mir.v2.${input.authorization.authorizationId.replace(/^mpsa\./, '')}`,
    recipient: input.recipient,
    productiveContributionId: input.authorization.contributionId,
    fingerprint: input.authorization.contributionFingerprint,
    category: input.category,
    inputQuantity: input.inputQuantity,
    inputUnit: input.inputUnit,
    policyVersion: input.authorization.productiveValuePolicyVersion,
    formulaInputs: Object.freeze({
      formulaVersion: 'moonrey.issuance.formula.v1',
      formulaPathClass: 'LEGACY_ENGINEERING_SIMULATION_V1',
      eligibleQuantity: 0n,
      categoryWeight: 0n,
      claimTypeWeight: 0n,
      qualityFactor: 0n,
      roundingMode: 'FLOOR',
      uncappedQuantity: 0n,
      moonreyQuantity: 0n,
    }),
    rounding: 'FLOOR',
    moonreyQuantity: input.authorization.authorizedMoonReyQuantity,
    oracleFacts: input.oracleFacts,
    blockHeight: input.blockHeight,
    blockId: input.blockId,
    pathClass: GOVERNED_VALUE_SIMULATION_PATH_CLASS,
    eventId: input.authorization.eventId,
    attributionDecisionId: input.authorization.attributionDecisionId,
    normalizationReceiptId: input.authorization.normalizationReceiptId,
    productiveValueId: input.authorization.productiveValueId,
    productiveValueDigest: input.authorization.productiveValueDigest,
    valueFunctionPolicy: Object.freeze({
      policyId: input.authorization.productiveValuePolicyId,
      policyVersion: input.authorization.productiveValuePolicyVersion,
    }),
    conversionPolicy: Object.freeze({
      policyId: input.authorization.conversionPolicyId,
      policyVersion: input.authorization.conversionPolicyVersion,
    }),
    monetaryPolicyVersion: input.monetaryPolicyVersion,
  });
}
