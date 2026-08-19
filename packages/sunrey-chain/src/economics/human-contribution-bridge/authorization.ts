/**
 * Settlement/valuation authorization port.
 *
 * Chunk 108 does not implement the Human Contribution Valuation Engine.
 * Deterministic fixtures may create DEVELOPMENT/SIMULATION authorizations
 * only. Production authorization remains unavailable.
 */

import { evidenceHash } from '../issuance.ts';
import { firewallRejection, isSha256Hex } from './firewall.ts';
import type {
  BridgeRejection,
  HumanContributionSettlementAuthorization,
  VerifiedHumanEconomicContribution,
} from './types.ts';

export const FUTURE_VALUATION_POLICY_REF = 'UNCONFIGURED.future-human-contribution-valuation-engine' as const;
export const VALUATION_VERSION_UNAVAILABLE = 'UNAVAILABLE' as const;

export function createDevelopmentSettlementAuthorization(input: {
  readonly contribution: VerifiedHumanEconomicContribution;
  readonly authorizedSunReyQuantity: bigint;
  readonly authorizedAt?: string;
  readonly authorizationId?: string;
  readonly environment?: 'DEVELOPMENT' | 'SIMULATION';
}): HumanContributionSettlementAuthorization {
  if (input.authorizedSunReyQuantity <= 0n) {
    throw new TypeError('development settlement authorization requires a positive fixture quantity');
  }
  const environment = input.environment ?? 'DEVELOPMENT';
  const authorizationId = input.authorizationId ?? `hcesa.dev.${input.contribution.contributionId}`;
  return Object.freeze({
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
  return 'PRODUCTION_ISSUANCE_UNAVAILABLE';
}

export function validateSettlementAuthorization(
  contribution: VerifiedHumanEconomicContribution,
  authorization: HumanContributionSettlementAuthorization,
): BridgeRejection | null {
  const poisoned = firewallRejection(authorization);
  if (poisoned) {
    return poisoned;
  }
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
  if (authorization.authorizedBy !== 'HUMAN' && authorization.authorizedBy !== 'PROTOCOL' && authorization.authorizedBy !== 'DEVELOPMENT_FIXTURE') {
    return 'AUTHORIZATION_ACTOR_FORBIDDEN';
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
