/**
 * MoonReyProductiveSettlementAuthorization.
 *
 * A ProductiveValueResult cannot mint. AI / S3M / Grok / agents /
 * oracle providers / controllers cannot authorize. Chunk 71 still
 * makes the final issuance decision.
 */

import { convertGpuvToMoonRey, mostRestrictiveCap, remainingCap, validateConversionPolicy } from './conversion.ts';
import { computeAuthorizationEvidenceDigest, computeProductiveValueDigest, containsRawProviderData, isSha256Hex } from './digest.ts';
import type {
  ForbiddenSettlementAuthorizer,
  MoonReyProductiveSettlementAuthorization,
  ProductiveValueResult,
  SettlementAuthorizer,
  SettlementContext,
  SettlementRejection,
  SettlementResult,
} from './types.ts';
import { FORBIDDEN_SETTLEMENT_AUTHORIZERS, SETTLEMENT_AUTHORIZERS } from './types.ts';

export function actorAuthorizationRejection(
  authorizedBy: string,
  controller?: string,
): SettlementRejection | null {
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
  if (authorizedBy === 'ORACLE_PROVIDER') {
    return 'ORACLE_PROVIDER_CANNOT_AUTHORIZE_ISSUANCE';
  }
  if (
    authorizedBy === 'PRODUCTIVE_CONTROLLER' ||
    authorizedBy === 'CONTROLLER' ||
    (controller !== undefined && authorizedBy === controller)
  ) {
    return 'CONTROLLER_SELF_AUTHORIZATION_REJECTED';
  }
  if ((FORBIDDEN_SETTLEMENT_AUTHORIZERS as readonly string[]).includes(authorizedBy)) {
    return 'AUTHORIZATION_ACTOR_FORBIDDEN';
  }
  if (!(SETTLEMENT_AUTHORIZERS as readonly string[]).includes(authorizedBy)) {
    return 'AUTHORIZATION_ACTOR_FORBIDDEN';
  }
  return null;
}

function attributionCap(value: ProductiveValueResult): bigint {
  if (value.attributionShare.denominator <= 0n) {
    return 0n;
  }
  return (value.eventBasisQuantity * value.attributionShare.numerator) / value.attributionShare.denominator;
}

export function createProductiveSettlementAuthorization(input: SettlementContext): SettlementResult {
  if (containsRawProviderData(input)) {
    return { ok: false, code: 'RAW_PROVIDER_PAYLOAD_FORBIDDEN' };
  }
  const actorRejection = actorAuthorizationRejection(input.authorizedBy, input.contribution.controller);
  if (actorRejection) {
    return { ok: false, code: actorRejection };
  }
  const value = input.valueResult;
  if (value.canMint || PRODUCTIVE_VALUE_HAS_MINT_METHOD(value)) {
    return { ok: false, code: 'PRODUCTIVE_VALUE_RESULT_CANNOT_MINT' };
  }
  if (value.state !== 'VALUED_SIMULATION') {
    return { ok: false, code: 'VALUE_STATE_INVALID' };
  }
  if (value.productionActivated || value.environment === 'PRODUCTION_CANDIDATE') {
    return { ok: false, code: 'PRODUCTION_V2_UNAVAILABLE' };
  }
  if (value.productiveValueUnit !== 'GPUV') {
    return { ok: false, code: 'CONVERSION_POLICY_INVALID' };
  }
  if (value.contributionId !== input.contribution.contributionId) {
    return { ok: false, code: 'CONTRIBUTION_MISMATCH' };
  }
  if (value.contributionFingerprint !== input.contribution.fingerprint) {
    return { ok: false, code: 'CONTRIBUTION_FINGERPRINT_MISMATCH' };
  }
  if (value.eventId !== input.event.eventId) {
    return { ok: false, code: 'EVENT_MISMATCH' };
  }
  if (value.eventFingerprint !== input.event.eventFingerprint) {
    return { ok: false, code: 'EVENT_MISMATCH' };
  }
  if (value.attributionDecisionId !== input.attributionDecision.decisionId) {
    return { ok: false, code: 'ATTRIBUTION_DECISION_MISMATCH' };
  }
  if (input.attributionDecision.eventId !== input.event.eventId) {
    return { ok: false, code: 'ATTRIBUTION_DECISION_MISMATCH' };
  }
  if (value.normalizationReceiptId !== input.contribution.normalizationReceiptId && input.contribution.normalizationReceiptId) {
    return { ok: false, code: 'NORMALIZATION_RECEIPT_MISMATCH' };
  }
  if (computeProductiveValueDigest(value) !== value.productiveValueDigest || !isSha256Hex(value.productiveValueDigest)) {
    return { ok: false, code: 'VALUE_DIGEST_INVALID' };
  }
  const conversionCheck = validateConversionPolicy(input.conversionPolicy, input.height ?? 1);
  if (conversionCheck) {
    return { ok: false, code: conversionCheck };
  }
  const jurisdiction = input.jurisdiction ?? input.contribution.geography.jurisdiction;
  if (value.jurisdiction !== jurisdiction) {
    return { ok: false, code: 'JURISDICTION_POLICY_MISMATCH' };
  }
  if (value.productiveValueQuantity > value.valueFunctionQuantityCap) {
    return { ok: false, code: 'CAP_EXCEEDED' };
  }
  if (value.productiveValueQuantity > attributionCap(value)) {
    return { ok: false, code: 'CAP_EXCEEDED' };
  }
  const converted = convertGpuvToMoonRey(value.productiveValueQuantity, input.conversionPolicy);
  if (converted <= 0n) {
    return { ok: false, code: 'CONVERSION_POLICY_INVALID' };
  }
  const usage = input.usage ?? {
    eventIssued: 0n,
    objectIssued: 0n,
    controllerIssued: 0n,
    categoryEpochIssued: 0n,
    globalEpochIssued: 0n,
  };
  const quantityCeiling = mostRestrictiveCap([
    converted,
    input.conversionPolicy.perContributionCeiling,
    remainingCap(input.conversionPolicy.perEventCeiling, usage.eventIssued),
    remainingCap(input.conversionPolicy.perObjectCeiling, usage.objectIssued),
    remainingCap(input.conversionPolicy.perControllerCeiling, usage.controllerIssued),
    remainingCap(input.conversionPolicy.perCategoryEpochCeiling, usage.categoryEpochIssued),
    remainingCap(input.conversionPolicy.globalEpochCeiling, usage.globalEpochIssued),
    input.monetaryQuantityCeiling ?? converted,
  ]);
  if (converted > quantityCeiling) {
    return { ok: false, code: 'CAP_EXCEEDED' };
  }
  const authorizationId =
    input.authorizationId ?? `mpsa.${value.productiveValueId}.${input.contribution.fingerprint.slice(0, 16)}`;
  const authorizedAt = input.authorizedAt ?? '2026-08-19T00:00:00.000Z';
  const authorization: MoonReyProductiveSettlementAuthorization = Object.freeze({
    authorizationId,
    contributionId: input.contribution.contributionId,
    contributionFingerprint: input.contribution.fingerprint,
    eventId: value.eventId,
    eventFingerprint: value.eventFingerprint,
    productiveValueId: value.productiveValueId,
    productiveValueDigest: value.productiveValueDigest,
    productiveValuePolicyId: value.valueFunctionPolicyId,
    productiveValuePolicyVersion: value.valueFunctionPolicyVersion,
    productiveValueQuantity: value.productiveValueQuantity,
    productiveValueUnit: 'GPUV',
    conversionPolicyId: input.conversionPolicy.policyId,
    conversionPolicyVersion: input.conversionPolicy.policyVersion,
    authorizedMoonReyQuantity: converted,
    quantityCeiling,
    attributionDecisionId: value.attributionDecisionId,
    normalizationReceiptId: value.normalizationReceiptId,
    authorizedAt,
    authorizedBy: input.authorizedBy as SettlementAuthorizer,
    environment: input.conversionPolicy.environment,
    evidenceDigest: '',
    productionActivated: false,
    pathClass: 'GOVERNED_VALUE_SIMULATION_V2',
    gpuvEqualsMoonReyByDefinition: false,
    aiAuthorized: false,
    canMint: false,
  });
  return {
    ok: true,
    authorization: Object.freeze({
      ...authorization,
      evidenceDigest: computeAuthorizationEvidenceDigest(authorization),
    }),
  };
}

export function validateProductiveSettlementAuthorization(
  authorization: MoonReyProductiveSettlementAuthorization,
  input: SettlementContext,
): SettlementRejection | null {
  if (authorization.productionActivated || authorization.environment === 'PRODUCTION_CANDIDATE') {
    return 'PRODUCTION_V2_UNAVAILABLE';
  }
  if (authorization.pathClass !== 'GOVERNED_VALUE_SIMULATION_V2') {
    return 'PRODUCTION_PATH_UNAVAILABLE';
  }
  if (authorization.canMint) {
    return 'PRODUCTIVE_VALUE_RESULT_CANNOT_MINT';
  }
  if (authorization.aiAuthorized) {
    return 'AI_CANNOT_AUTHORIZE_ISSUANCE';
  }
  if (authorization.gpuvEqualsMoonReyByDefinition) {
    return 'GPUV_EQUALS_MOONREY_FORBIDDEN';
  }
  const actorRejection = actorAuthorizationRejection(authorization.authorizedBy, input.contribution.controller);
  if (actorRejection) {
    return actorRejection;
  }
  if (authorization.contributionId !== input.contribution.contributionId) {
    return 'CONTRIBUTION_MISMATCH';
  }
  if (authorization.contributionFingerprint !== input.contribution.fingerprint) {
    return 'CONTRIBUTION_FINGERPRINT_MISMATCH';
  }
  if (authorization.eventId !== input.event.eventId || authorization.eventFingerprint !== input.event.eventFingerprint) {
    return 'EVENT_MISMATCH';
  }
  if (authorization.attributionDecisionId !== input.attributionDecision.decisionId) {
    return 'ATTRIBUTION_DECISION_MISMATCH';
  }
  if (authorization.productiveValueId !== input.valueResult.productiveValueId) {
    return 'PRODUCTIVE_VALUE_ALONE_CANNOT_ISSUE';
  }
  if (authorization.productiveValueDigest !== input.valueResult.productiveValueDigest) {
    return 'VALUE_DIGEST_INVALID';
  }
  if (authorization.productiveValuePolicyId !== input.valueResult.valueFunctionPolicyId) {
    return 'VALUE_FUNCTION_POLICY_MISMATCH';
  }
  if (authorization.productiveValuePolicyVersion !== input.valueResult.valueFunctionPolicyVersion) {
    return 'VALUE_FUNCTION_POLICY_VERSION_MISMATCH';
  }
  if (
    authorization.conversionPolicyId !== input.conversionPolicy.policyId ||
    authorization.conversionPolicyVersion !== input.conversionPolicy.policyVersion
  ) {
    return 'VALUE_FUNCTION_POLICY_VERSION_MISMATCH';
  }
  const expected = convertGpuvToMoonRey(input.valueResult.productiveValueQuantity, input.conversionPolicy);
  if (expected !== authorization.authorizedMoonReyQuantity) {
    return 'CONVERSION_POLICY_INVALID';
  }
  if (authorization.authorizedMoonReyQuantity > authorization.quantityCeiling) {
    return 'CAP_EXCEEDED';
  }
  if (computeAuthorizationEvidenceDigest(authorization) !== authorization.evidenceDigest) {
    return 'VALUE_DIGEST_INVALID';
  }
  if (containsRawProviderData(authorization)) {
    return 'RAW_PROVIDER_PAYLOAD_FORBIDDEN';
  }
  return null;
}

function PRODUCTIVE_VALUE_HAS_MINT_METHOD(value: ProductiveValueResult): boolean {
  const record = value as ProductiveValueResult & { readonly mint?: unknown; readonly issue?: unknown };
  return typeof record.mint === 'function' || typeof record.issue === 'function';
}

export function isForbiddenAuthorizer(actor: string): actor is ForbiddenSettlementAuthorizer {
  return (FORBIDDEN_SETTLEMENT_AUTHORIZERS as readonly string[]).includes(actor);
}
