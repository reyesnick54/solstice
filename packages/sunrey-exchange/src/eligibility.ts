import type { ExchangeInstrument, EligibilityContext, EligibilityDecision, UniversalOrder } from './types-universal.ts';
import type { EligibilityReasonCode, MarketAccessPolicy } from './taxonomy.ts';

/**
 * STAGE 1 — deterministic eligibility filtering.
 * An economically optimal order that fails eligibility cannot match.
 */
export function evaluateEligibility(
  instrument: ExchangeInstrument,
  actor: EligibilityContext,
  counterparty?: EligibilityContext,
): EligibilityDecision {
  const reasons: EligibilityReasonCode[] = [];
  const policy = instrument.eligibilityPolicy;

  if (policy.requireVerifiedAccount && !actor.verifiedAccount) {
    reasons.push('IDENTITY_INELIGIBLE');
  }
  if (!policy.counterpartyClasses.includes(actor.actorClass)) {
    reasons.push('COUNTERPARTY_CLASS_DENIED');
  }
  if (policy.humanOnly && actor.actorClass === 'MACHINE') {
    reasons.push('HUMAN_ONLY_MARKET');
  }
  if (!policy.machineAllowed && actor.machineId) {
    reasons.push('MACHINE_NOT_ALLOWED');
  }
  if (policy.requiredCapabilities.length > 0) {
    const missing = policy.requiredCapabilities.some((cap) => !actor.capabilities.includes(cap));
    if (missing) {
      reasons.push('CAPABILITY_MISSING');
    }
  }
  if (
    instrument.jurisdictionPolicy.denied.includes(actor.jurisdiction) ||
    (instrument.jurisdictionPolicy.permitted.length > 0 &&
      !instrument.jurisdictionPolicy.permitted.includes(actor.jurisdiction))
  ) {
    reasons.push('JURISDICTION_DENIED');
  }
  if (
    instrument.deliveryPolicy.geographyRequired &&
    actor.geography &&
    instrument.deliveryPolicy.permittedGeographies.length > 0 &&
    !instrument.deliveryPolicy.permittedGeographies.includes(actor.geography)
  ) {
    reasons.push('DELIVERY_GEOGRAPHY_DENIED');
  }
  if (instrument.rightsPolicy.requiresConsent) {
    if (actor.consentRevoked) {
      reasons.push('CONSENT_REVOKED');
    } else if (!actor.consentActive) {
      reasons.push('CONSENT_MISSING');
    }
  }
  if (instrument.rightsPolicy.requiresPurpose) {
    const expected =
      instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT' ? instrument.extension.purpose : null;
    if (!actor.purpose || (expected && actor.purpose !== expected)) {
      reasons.push('PURPOSE_MISMATCH');
    }
    if (
      instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT' &&
      actor.recipientClass &&
      !instrument.extension.recipientEligibility.includes(actor.recipientClass)
    ) {
      reasons.push('COUNTERPARTY_CLASS_DENIED');
    }
  }
  if (instrument.oraclePolicy.required && instrument.status === 'EXPIRED') {
    reasons.push('ORACLE_REQUIREMENT_UNMET');
  }
  if (instrument.status === 'EXPIRED' || instrument.status === 'DELISTED' || instrument.status === 'SUSPENDED') {
    reasons.push('INSTRUMENT_EXPIRED');
  }
  if (!accessAllows(policy.access, actor.access, actor)) {
    reasons.push('MARKET_ACCESS_DENIED');
  }
  if (instrument.rightsPolicy.rawExportAllowed !== false) {
    reasons.push('RAW_INFORMATION_UNAVAILABLE');
  }
  if (counterparty) {
    const contra = evaluateEligibility(instrument, counterparty);
    if (!contra.eligible) {
      reasons.push(...contra.reasonCodes.filter((code) => code !== 'ELIGIBLE'));
    }
  }

  const unique = [...new Set(reasons)];
  return Object.freeze({
    eligible: unique.length === 0,
    reasonCodes: unique.length === 0 ? (['ELIGIBLE'] as const) : unique,
  });
}

export function accessAllows(
  required: MarketAccessPolicy,
  actorAccess: MarketAccessPolicy,
  actor: EligibilityContext,
): boolean {
  if (required === 'PUBLIC_DEVELOPMENT') {
    return true;
  }
  if (required === 'VERIFIED_ACCOUNT') {
    return actor.verifiedAccount;
  }
  if (required === 'INSTITUTIONAL_ONLY') {
    return actor.actorClass === 'INSTITUTION';
  }
  if (required === 'ELIGIBLE_COUNTERPARTY') {
    return actor.actorClass === 'ELIGIBLE_COUNTERPARTY' || actor.actorClass === 'INSTITUTION';
  }
  if (required === 'MACHINE_ALLOWED') {
    return actor.actorClass === 'MACHINE' || actorAccess === 'MACHINE_ALLOWED' || actorAccess === 'PUBLIC_DEVELOPMENT';
  }
  if (required === 'HUMAN_ONLY') {
    return actor.actorClass !== 'MACHINE';
  }
  return actorAccess === required;
}

export function filterEligibleCounterparties(
  instrument: ExchangeInstrument,
  incoming: UniversalOrder,
  incomingCtx: EligibilityContext,
  resting: readonly UniversalOrder[],
  contextFor: (order: UniversalOrder) => EligibilityContext,
): {
  readonly eligible: UniversalOrder[];
  readonly rejected: readonly { readonly orderId: string; readonly reasonCodes: readonly EligibilityReasonCode[] }[];
} {
  const self = evaluateEligibility(instrument, incomingCtx);
  if (!self.eligible) {
    return {
      eligible: [],
      rejected: [{ orderId: incoming.orderId, reasonCodes: self.reasonCodes }],
    };
  }
  const eligible: UniversalOrder[] = [];
  const rejected: { orderId: string; reasonCodes: readonly EligibilityReasonCode[] }[] = [];
  for (const order of resting) {
    if (order.side === incoming.side) {
      continue;
    }
    const decision = evaluateEligibility(instrument, incomingCtx, contextFor(order));
    if (decision.eligible) {
      eligible.push(order);
    } else {
      rejected.push({ orderId: order.orderId, reasonCodes: decision.reasonCodes });
    }
  }
  return { eligible, rejected };
}
