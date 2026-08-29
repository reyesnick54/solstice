import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import { evaluateEligibility } from '../eligibility.ts';
import type { EligibilityContext, ExchangeInstrument } from '../types-universal.ts';
import type { EligibilityReasonCode } from '../taxonomy.ts';
import { validateConsideration } from './consideration.ts';
import { evaluateTermsCompleteness, windowCoversHeight } from './terms.ts';
import type {
  CapacityAccessTerms,
  CapacityMarketConfiguration,
  ConsiderationTerms,
} from './types.ts';
import type {
  AccessPolicyRefusalCode,
  CapacityTradeMechanism,
} from './taxonomy.ts';

/**
 * Capacity access policy gate.
 *
 * All regulated execution stays behind the gates that already exist: instrument
 * eligibility and jurisdiction policy from `../eligibility.ts`, product
 * configuration, and a signed Execution Authority for any consequential
 * consideration movement. This gate refuses; it never issues authority and never
 * proceeds past a refusal.
 */
export type CapacityAccessDecision = {
  readonly permitted: boolean;
  readonly refusalCodes: readonly AccessPolicyRefusalCode[];
  readonly eligibilityReasonCodes: readonly EligibilityReasonCode[];
  readonly authorityRequired: boolean;
  readonly authorityPresent: boolean;
};

export type CapacityAccessRequest = {
  readonly configuration: CapacityMarketConfiguration;
  readonly instrument: ExchangeInstrument;
  readonly terms: CapacityAccessTerms;
  readonly mechanism: CapacityTradeMechanism;
  readonly consideration: ConsiderationTerms;
  readonly actor: EligibilityContext;
  readonly counterparty?: EligibilityContext;
  readonly height: bigint;
  readonly authority: ExecutionAuthority | null;
};

export function evaluateCapacityAccess(request: CapacityAccessRequest): CapacityAccessDecision {
  const refusals: AccessPolicyRefusalCode[] = [];

  const completeness = evaluateTermsCompleteness(request.terms);
  if (!completeness.complete) {
    refusals.push('TERMS_INCOMPLETE');
  }
  if (!request.configuration.permittedMechanisms.includes(request.mechanism)) {
    refusals.push('MECHANISM_NOT_PERMITTED');
  }
  if (
    request.instrument.status !== 'SIMULATION_LISTED' ||
    !request.instrument.operationalReady
  ) {
    refusals.push('INSTRUMENT_NOT_TRADEABLE');
  }
  if (!windowCoversHeight(request.terms.availabilityWindow, request.height)) {
    refusals.push('AVAILABILITY_WINDOW_CLOSED');
  }
  if (!request.terms.serviceClass.label) {
    refusals.push('SERVICE_CLASS_UNSUPPORTED');
  }
  if (!request.terms.rightsTerms.rightsReference) {
    refusals.push('RIGHTS_TERMS_MISSING');
  }
  if (
    request.terms.provenance.attestationRefs.length === 0 &&
    request.terms.provenance.oracleFactIds.length === 0
  ) {
    refusals.push('PROVENANCE_MISSING');
  }
  if (jurisdictionForbidden(request.configuration, request.terms, request.actor.jurisdiction)) {
    refusals.push('JURISDICTION_FORBIDDEN');
  }

  const considerationCheck = validateConsideration({
    configuration: request.configuration,
    terms: request.terms,
    consideration: request.consideration,
  });
  if (!considerationCheck.valid) {
    refusals.push('CONSIDERATION_NOT_PERMITTED');
  }

  const eligibility = request.counterparty
    ? evaluateEligibility(request.instrument, request.actor, request.counterparty)
    : evaluateEligibility(request.instrument, request.actor);
  if (!eligibility.eligible) {
    if (eligibility.reasonCodes.includes('JURISDICTION_DENIED')) {
      refusals.push('JURISDICTION_FORBIDDEN');
    }
    refusals.push('ELIGIBILITY_DENIED');
  }

  const authorityRequired = considerationRequiresAuthority(request);
  const authorityPresent =
    request.authority !== null &&
    request.authority.actionType === ACTION_TYPES.SETTLE_EXCHANGE_TRADE;

  const unique = [...new Set(refusals)];
  return Object.freeze({
    permitted: unique.length === 0 && (!authorityRequired || authorityPresent),
    refusalCodes: Object.freeze(unique),
    eligibilityReasonCodes: eligibility.reasonCodes,
    authorityRequired,
    authorityPresent,
  });
}

/**
 * Fiat and native-coin consideration are consequential state changes and
 * require a signed, scoped Execution Authority. Entitlement-only and
 * reward-only reservations consume a prior grant at its owning port and move no
 * money, so they do not need one.
 */
export function considerationRequiresAuthority(input: {
  readonly configuration: CapacityMarketConfiguration;
  readonly consideration: ConsiderationTerms;
}): boolean {
  if (!input.configuration.requiresExecutionAuthorityForConsideration) {
    return false;
  }
  return input.consideration.legs.some(
    (leg) => leg.kind === 'FIAT' || leg.kind === 'SUNREY_COIN' || leg.kind === 'MOONREY_COIN',
  );
}

export function jurisdictionForbidden(
  configuration: CapacityMarketConfiguration,
  terms: CapacityAccessTerms,
  jurisdiction: Jurisdiction,
): boolean {
  if (configuration.deniedJurisdictions.includes(jurisdiction)) {
    return true;
  }
  if (terms.policyRequirements.deniedJurisdictions.includes(jurisdiction)) {
    return true;
  }
  return (
    terms.policyRequirements.permittedJurisdictions.length > 0 &&
    !terms.policyRequirements.permittedJurisdictions.includes(jurisdiction)
  );
}

export function capacityMarketConfiguration(input: {
  readonly marketId: CapacityMarketConfiguration['marketId'];
  readonly permittedMechanisms: readonly CapacityTradeMechanism[];
  readonly permittedConsideration: CapacityMarketConfiguration['permittedConsideration'];
  readonly defaultSemantics: CapacityMarketConfiguration['defaultSemantics'];
  readonly deniedJurisdictions?: readonly Jurisdiction[];
}): CapacityMarketConfiguration {
  return Object.freeze({
    marketId: input.marketId,
    permittedMechanisms: Object.freeze([...input.permittedMechanisms]),
    permittedConsideration: Object.freeze([...input.permittedConsideration]),
    defaultSemantics: input.defaultSemantics,
    deniedJurisdictions: Object.freeze([...(input.deniedJurisdictions ?? [])]),
    requiresExecutionAuthorityForConsideration: true,
  });
}
