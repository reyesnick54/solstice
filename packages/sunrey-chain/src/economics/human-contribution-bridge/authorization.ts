/**
 * Settlement/valuation authorization port.
 *
 * Versioned paths:
 * - LEGACY_DEVELOPMENT_FIXTURE keeps Chunk 108 fixture semantics
 * - ENGINE_VALUATION_SIMULATION requires a valuation result and
 *   a simulation conversion policy
 * - PRODUCTION remains unavailable
 */

import { evidenceHash } from '../issuance.ts';
import { toSettlementAuthorizationCandidate } from './adapter.ts';
import {
  convertReferenceToSunRey,
  mostRestrictiveCap,
  validateConversionPolicy,
} from './conversion.ts';
import { firewallRejection, isSha256Hex } from './firewall.ts';
import type {
  BridgeRejection,
  EngineValuationReference,
  EngineValuationSettlementAuthorization,
  HumanContributionSettlementAuthorization,
  LegacyFixtureSettlementAuthorization,
  SettlementAuthorizer,
  SunReyHumanSettlementConversionPolicy,
  VerifiedHumanEconomicContribution,
} from './types.ts';

export const FUTURE_VALUATION_POLICY_REF = 'UNCONFIGURED.future-human-contribution-valuation-engine' as const;
export const VALUATION_VERSION_UNAVAILABLE = 'UNAVAILABLE' as const;

export function isEngineValuationAuthorization(
  authorization: HumanContributionSettlementAuthorization,
): authorization is EngineValuationSettlementAuthorization {
  return authorization.valuationPath === 'ENGINE_VALUATION_SIMULATION' || authorization.schemaVersion === 2;
}

export function isLegacyFixtureAuthorization(
  authorization: HumanContributionSettlementAuthorization,
): authorization is LegacyFixtureSettlementAuthorization {
  return !isEngineValuationAuthorization(authorization);
}

export function createDevelopmentSettlementAuthorization(input: {
  readonly contribution: VerifiedHumanEconomicContribution;
  readonly authorizedSunReyQuantity: bigint;
  readonly authorizedAt?: string;
  readonly authorizationId?: string;
  readonly environment?: 'DEVELOPMENT' | 'SIMULATION';
}): LegacyFixtureSettlementAuthorization {
  if (input.authorizedSunReyQuantity <= 0n) {
    throw new TypeError('development settlement authorization requires a positive fixture quantity');
  }
  const environment = input.environment ?? 'DEVELOPMENT';
  const authorizationId = input.authorizationId ?? `hcesa.dev.${input.contribution.contributionId}`;
  return Object.freeze({
    schemaVersion: 1,
    valuationPath: 'LEGACY_DEVELOPMENT_FIXTURE',
    authorizationId,
    contributionId: input.contribution.contributionId,
    fingerprint: input.contribution.fingerprint,
    valuationPolicyRef: FUTURE_VALUATION_POLICY_REF,
    valuationVersion: VALUATION_VERSION_UNAVAILABLE,
    authorizedQuantityBasis: input.authorizedSunReyQuantity,
    authorizedSunReyQuantity: input.authorizedSunReyQuantity,
    quantityCeiling: input.authorizedSunReyQuantity,
    jurisdictionPolicyRef: input.contribution.jurisdictionPolicyRef,
    authorizedBy: 'DEVELOPMENT_FIXTURE',
    authorizedAt: input.authorizedAt ?? '2026-08-19T00:00:00.000Z',
    environment,
    simulationOnly: true,
    productionStatus: 'UNAVAILABLE',
    evidenceDigest: evidenceHash(
      `${authorizationId}:${input.contribution.fingerprint}:${input.authorizedSunReyQuantity.toString()}`,
    ),
    quantitySource: environment === 'SIMULATION' ? 'SIMULATION_FIXTURE' : 'DEVELOPMENT_FIXTURE',
    valuationEngineImplemented: false,
    peveUsedAsTokenFormula: false,
    aiAuthorized: false,
  });
}

export function rejectProductionSettlementAuthorization(): BridgeRejection {
  return 'PRODUCTION_SETTLEMENT_AUTHORIZATION_UNAVAILABLE';
}

function actorAuthorizationRejection(authorizedBy: string): BridgeRejection | null {
  if (authorizedBy === 'AI') {
    return 'AI_CANNOT_AUTHORIZE_ISSUANCE';
  }
  if (authorizedBy === 'FINANCIAL_AGENT' || authorizedBy === 'AGENT') {
    return 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_ISSUANCE';
  }
  if (authorizedBy === 'S3M') {
    return 'S3M_CANNOT_AUTHORIZE_ISSUANCE';
  }
  if (authorizedBy === 'GROK') {
    return 'GROK_CANNOT_AUTHORIZE_ISSUANCE';
  }
  if (authorizedBy === 'MODEL' || authorizedBy === 'MODEL_OUTPUT') {
    return 'MODEL_OUTPUT_CANNOT_AUTHORIZE_ISSUANCE';
  }
  if (
    authorizedBy !== 'HUMAN' &&
    authorizedBy !== 'PROTOCOL' &&
    authorizedBy !== 'DEVELOPMENT_FIXTURE' &&
    authorizedBy !== 'GOVERNED_PROTOCOL_SIMULATION'
  ) {
    return 'AUTHORIZATION_ACTOR_FORBIDDEN';
  }
  return null;
}

function expectedValuationDigest(valuation: EngineValuationReference): string {
  return evidenceHash(
    [
      'hcv.v1',
      valuation.valuationId,
      valuation.contributionId,
      valuation.fingerprint,
      valuation.valuationPolicyId,
      valuation.valuationPolicyVersion,
      valuation.valuationMethod,
      valuation.finalReferenceValue.toString(),
      valuation.referenceDenomination,
    ].join(':'),
  );
}

export function createValuationSettlementAuthorization(input: {
  readonly contribution: VerifiedHumanEconomicContribution;
  readonly valuation: EngineValuationReference;
  readonly conversionPolicy: SunReyHumanSettlementConversionPolicy;
  readonly authorizedBy: SettlementAuthorizer;
  readonly authorizedAt?: string;
  readonly authorizationId?: string;
  readonly monetaryQuantityCeiling?: bigint;
}):
  | { readonly ok: true; readonly authorization: EngineValuationSettlementAuthorization }
  | { readonly ok: false; readonly code: BridgeRejection } {
  const actorRejection = actorAuthorizationRejection(input.authorizedBy);
  if (actorRejection) {
    return { ok: false, code: actorRejection };
  }
  if (input.contribution.verificationState !== 'VERIFIED' && input.contribution.verificationState !== 'SUPERSEDED') {
    return { ok: false, code: 'INVALID_CONTRIBUTION' };
  }
  const candidate = toSettlementAuthorizationCandidate(input.valuation);
  if (!candidate.ok) {
    return candidate;
  }
  if (input.valuation.contributionId !== input.contribution.contributionId) {
    return { ok: false, code: 'VALUATION_CONTRIBUTION_MISMATCH' };
  }
  if (input.valuation.fingerprint !== input.contribution.fingerprint) {
    return { ok: false, code: 'VALUATION_FINGERPRINT_MISMATCH' };
  }
  if (input.valuation.jurisdictionPolicyRef !== input.contribution.jurisdictionPolicyRef) {
    return { ok: false, code: 'JURISDICTION_POLICY_MISMATCH' };
  }
  if (input.conversionPolicy.jurisdictionPolicyRef !== input.contribution.jurisdictionPolicyRef) {
    return { ok: false, code: 'JURISDICTION_POLICY_MISMATCH' };
  }
  if (input.conversionPolicy.inputDenomination !== input.valuation.referenceDenomination) {
    return { ok: false, code: 'CONVERSION_POLICY_INVALID' };
  }
  const conversionCheck = validateConversionPolicy(input.conversionPolicy);
  if (conversionCheck) {
    return { ok: false, code: conversionCheck };
  }
  if (expectedValuationDigest(input.valuation) !== input.valuation.valuationDigest) {
    return { ok: false, code: 'VALUATION_DIGEST_INVALID' };
  }
  const converted = convertReferenceToSunRey(input.valuation.finalReferenceValue, input.conversionPolicy);
  if (converted <= 0n) {
    return { ok: false, code: 'CONVERSION_POLICY_INVALID' };
  }
  const monetaryCeiling = input.monetaryQuantityCeiling ?? converted;
  const quantityCeiling = mostRestrictiveCap([
    input.conversionPolicy.perContributionCeiling,
    monetaryCeiling,
    converted,
  ]);
  if (converted > quantityCeiling) {
    return { ok: false, code: 'CAP_EXCEEDED' };
  }
  const authorizationId =
    input.authorizationId ?? `hcesa.engine.${input.contribution.contributionId}.${input.valuation.valuationId}`;
  const authorizedAt = input.authorizedAt ?? '2026-08-19T00:00:00.000Z';
  return {
    ok: true,
    authorization: Object.freeze({
      schemaVersion: 2,
      valuationPath: 'ENGINE_VALUATION_SIMULATION',
      authorizationId,
      contributionId: input.contribution.contributionId,
      fingerprint: input.contribution.fingerprint,
      valuationId: input.valuation.valuationId,
      valuationPolicyRef: input.valuation.valuationPolicyId,
      valuationVersion: input.valuation.valuationPolicyVersion,
      valuationDigest: input.valuation.valuationDigest,
      referenceValue: input.valuation.finalReferenceValue,
      referenceDenomination: input.valuation.referenceDenomination,
      conversionPolicyRef: input.conversionPolicy.policyId,
      conversionPolicyVersion: input.conversionPolicy.version,
      authorizedQuantityBasis: converted,
      authorizedSunReyQuantity: converted,
      quantityCeiling,
      jurisdictionPolicyRef: input.contribution.jurisdictionPolicyRef,
      authorizedBy: input.authorizedBy,
      authorizedAt,
      environment: input.conversionPolicy.environment,
      simulationOnly: true,
      productionStatus: 'UNAVAILABLE',
      evidenceDigest: evidenceHash(
        [
          authorizationId,
          input.contribution.fingerprint,
          input.valuation.valuationId,
          input.valuation.valuationDigest,
          input.conversionPolicy.version,
          converted.toString(),
        ].join(':'),
      ),
      quantitySource: 'ENGINE_VALUATION_SIMULATION',
      valuationEngineImplemented: true,
      productionValuationActivated: false,
      productionActivated: false,
      peveUsedAsTokenFormula: false,
      humanWorthUsedAsValue: false,
      aiAuthorized: false,
      referenceValueEqualsSunReyByDefinition: false,
      parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
    }),
  };
}

function validateEngineAuthorization(
  contribution: VerifiedHumanEconomicContribution,
  authorization: EngineValuationSettlementAuthorization,
  valuation?: EngineValuationReference,
  conversionPolicy?: SunReyHumanSettlementConversionPolicy,
): BridgeRejection | null {
  if (authorization.environment === 'PRODUCTION' || authorization.productionActivated) {
    return 'PRODUCTION_ISSUANCE_UNAVAILABLE';
  }
  if (authorization.productionValuationActivated) {
    return 'PRODUCTION_VALUATION_UNAVAILABLE';
  }
  if (!authorization.simulationOnly) {
    return 'PRODUCTION_ISSUANCE_UNAVAILABLE';
  }
  if (!authorization.valuationEngineImplemented) {
    return 'VALUATION_ENGINE_UNAVAILABLE';
  }
  if (authorization.peveUsedAsTokenFormula) {
    return 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY';
  }
  if (authorization.humanWorthUsedAsValue) {
    return 'HUMAN_WORTH_SCORE_REJECTED';
  }
  if (authorization.aiAuthorized) {
    return 'AI_CANNOT_AUTHORIZE_ISSUANCE';
  }
  const actorRejection = actorAuthorizationRejection(authorization.authorizedBy);
  if (actorRejection) {
    return actorRejection;
  }
  if (authorization.contributionId !== contribution.contributionId) {
    return 'VALUATION_CONTRIBUTION_MISMATCH';
  }
  if (authorization.fingerprint !== contribution.fingerprint) {
    return 'VALUATION_FINGERPRINT_MISMATCH';
  }
  if (authorization.jurisdictionPolicyRef !== contribution.jurisdictionPolicyRef) {
    return 'JURISDICTION_POLICY_MISMATCH';
  }
  if (authorization.authorizedSunReyQuantity <= 0n) {
    return 'QUANTITY_NOT_SEPARATELY_AUTHORIZED';
  }
  if (authorization.authorizedSunReyQuantity > authorization.quantityCeiling) {
    return 'CAP_EXCEEDED';
  }
  if (authorization.referenceValueEqualsSunReyByDefinition) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (!isSha256Hex(authorization.valuationDigest) || !isSha256Hex(authorization.evidenceDigest)) {
    return 'VALUATION_DIGEST_INVALID';
  }
  if (valuation) {
    if (valuation.valuationId !== authorization.valuationId) {
      return 'VALUATION_REQUIRED';
    }
    if (valuation.contributionId !== authorization.contributionId) {
      return 'VALUATION_CONTRIBUTION_MISMATCH';
    }
    if (valuation.fingerprint !== authorization.fingerprint) {
      return 'VALUATION_FINGERPRINT_MISMATCH';
    }
    if (valuation.valuationPolicyId !== authorization.valuationPolicyRef) {
      return 'VALUATION_POLICY_MISMATCH';
    }
    if (valuation.valuationPolicyVersion !== authorization.valuationVersion) {
      return 'VALUATION_POLICY_VERSION_MISMATCH';
    }
    if (valuation.valuationDigest !== authorization.valuationDigest) {
      return 'VALUATION_DIGEST_INVALID';
    }
    if (expectedValuationDigest(valuation) !== valuation.valuationDigest) {
      return 'VALUATION_DIGEST_INVALID';
    }
  }
  if (conversionPolicy) {
    const conversionCheck = validateConversionPolicy(conversionPolicy);
    if (conversionCheck) {
      return conversionCheck;
    }
    if (conversionPolicy.policyId !== authorization.conversionPolicyRef) {
      return 'CONVERSION_POLICY_INVALID';
    }
    if (conversionPolicy.version !== authorization.conversionPolicyVersion) {
      return 'VALUATION_POLICY_VERSION_MISMATCH';
    }
    const expected = convertReferenceToSunRey(authorization.referenceValue, conversionPolicy);
    if (expected !== authorization.authorizedSunReyQuantity) {
      return 'CONVERSION_POLICY_INVALID';
    }
    if (authorization.authorizedSunReyQuantity > conversionPolicy.perContributionCeiling) {
      return 'CAP_EXCEEDED';
    }
  }
  return null;
}

function validateLegacyAuthorization(
  contribution: VerifiedHumanEconomicContribution,
  authorization: LegacyFixtureSettlementAuthorization,
): BridgeRejection | null {
  if (authorization.environment === 'PRODUCTION') {
    return 'PRODUCTION_ISSUANCE_UNAVAILABLE';
  }
  if (!authorization.simulationOnly) {
    return 'PRODUCTION_ISSUANCE_UNAVAILABLE';
  }
  if (authorization.valuationEngineImplemented) {
    return 'VALUATION_ENGINE_UNAVAILABLE';
  }
  if (authorization.peveUsedAsTokenFormula) {
    return 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY';
  }
  if (authorization.aiAuthorized) {
    return 'AI_CANNOT_AUTHORIZE_ISSUANCE';
  }
  const actorRejection = actorAuthorizationRejection(authorization.authorizedBy);
  if (actorRejection) {
    return actorRejection;
  }
  if (authorization.contributionId !== contribution.contributionId || authorization.fingerprint !== contribution.fingerprint) {
    return 'AUTHORIZATION_CONTRIBUTION_MISMATCH';
  }
  if (authorization.authorizedSunReyQuantity <= 0n) {
    return 'QUANTITY_NOT_SEPARATELY_AUTHORIZED';
  }
  if (authorization.authorizedSunReyQuantity > authorization.quantityCeiling) {
    return 'QUANTITY_NOT_SEPARATELY_AUTHORIZED';
  }
  if (authorization.authorizedQuantityBasis !== authorization.authorizedSunReyQuantity) {
    return 'QUANTITY_NOT_SEPARATELY_AUTHORIZED';
  }
  if (authorization.quantitySource !== 'DEVELOPMENT_FIXTURE' && authorization.quantitySource !== 'SIMULATION_FIXTURE') {
    return 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY';
  }
  if (!isSha256Hex(authorization.evidenceDigest)) {
    return 'INVALID_CONTRIBUTION';
  }
  return null;
}

export function validateSettlementAuthorization(
  contribution: VerifiedHumanEconomicContribution,
  authorization: HumanContributionSettlementAuthorization,
  valuation?: EngineValuationReference,
  conversionPolicy?: SunReyHumanSettlementConversionPolicy,
): BridgeRejection | null {
  const poisoned = firewallRejection(authorization);
  if (poisoned) {
    return poisoned;
  }
  if (authorization.valuationPath === 'PRODUCTION') {
    return 'PRODUCTION_SETTLEMENT_AUTHORIZATION_UNAVAILABLE';
  }
  if (isEngineValuationAuthorization(authorization)) {
    return validateEngineAuthorization(contribution, authorization, valuation, conversionPolicy);
  }
  return validateLegacyAuthorization(contribution, authorization);
}
