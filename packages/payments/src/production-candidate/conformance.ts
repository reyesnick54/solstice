import { LIVE_BANKING_RAILS, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import type { Money } from '../../../money/src/money.ts';
import { corridorIsSimulationEnabled, findCorridor, type PaymentCorridor } from '../corridor.ts';
import type { InboundRailNotice } from '../rail-port.ts';
import { freezeInbound, type InboundRailPayment } from '../rail-inbound.ts';
import { freezeReturn, normalizeReturnReason, type RailReturnRecord } from '../rail-returns.ts';
import type { RailReturnMessage } from '../rail-port.ts';
import { selectRoute, type PaymentRoute, type RouteHardConstraints, type RouteSelection } from '../route.ts';
import type { TreasuryAdvisor, TreasuryRouteAdvice } from '../treasury-port.ts';
import { candidateIsRoutable } from './provider-profile.ts';
import type { BankingProviderCandidateProfile } from './banking-profile.ts';
import type { PaymentRailProviderCandidateProfile } from './rail-profile.ts';
import type { CandidateFxQuote } from './fx-profile.ts';
import { candidateQuoteIsExpired } from './fx-profile.ts';
import type { BaasAccountReference, ProviderOperationalBalance } from './types.ts';
import { PRODUCTION_CANDIDATE_FLAGS } from './types.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { asInboundPaymentId, asOpaqueAccountRef } from '../rail-ids.ts';

export type CandidateRouteFacts = {
  readonly corridorId: string;
  readonly currency: string;
  readonly rail: string;
  readonly providerState: PaymentRailProviderCandidateProfile['state'];
  readonly providerHealth: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'MAINTENANCE';
  readonly amount: Money;
  readonly sourceJurisdiction: string;
  readonly destinationJurisdiction: string;
  readonly corridorEnabledBySunReyPolicy: boolean;
  readonly providerClaimsCorridorSupported: boolean;
  readonly regulatoryCompatible: boolean;
};

export type HardFilterRejection = {
  readonly code: string;
  readonly message: string;
};

export function hardEligibilityFilters(facts: CandidateRouteFacts, profile: PaymentRailProviderCandidateProfile): HardFilterRejection | null {
  const corridor = findCorridor(facts.corridorId);
  if (!corridor || corridor.simulationStatus !== 'ACTIVE_SIMULATION' || !facts.corridorEnabledBySunReyPolicy) {
    return { code: 'CORRIDOR_DISABLED', message: 'unknown or disabled corridor remains RESEARCH_REQUIRED / DISABLED' };
  }
  if (corridor.policyStatus === 'RESEARCH_REQUIRED' && corridor.liveStatus !== 'DISABLED') {
    return { code: 'CORRIDOR_RESEARCH_REQUIRED', message: 'unconfirmed corridor is not live-enabled' };
  }
  if (!facts.regulatoryCompatible) {
    return { code: 'REGULATORY_HARD_FILTER', message: 'regulatory compatibility is a filter, not a score' };
  }
  if (facts.providerClaimsCorridorSupported && !facts.corridorEnabledBySunReyPolicy) {
    return { code: 'PROVIDER_CORRIDOR_NOT_SUNREY_POLICY', message: 'provider support does not infer legal permission' };
  }
  if (!candidateIsRoutable(facts.providerState) || !candidateIsRoutable(profile.state)) {
    return { code: 'PROVIDER_STATE', message: 'provider candidate is not routable' };
  }
  if (facts.providerHealth === 'UNAVAILABLE' || facts.providerHealth === 'MAINTENANCE') {
    return { code: 'PROVIDER_HEALTH', message: 'provider health blocks routing' };
  }
  if (profile.railClass !== facts.rail) {
    return { code: 'RAIL', message: 'rail class mismatch' };
  }
  if (!profile.currencies.includes(facts.currency as never)) {
    return { code: 'CURRENCY', message: 'currency not supported by rail candidate' };
  }
  if (!profile.sourceJurisdictions.includes(facts.sourceJurisdiction)) {
    return { code: 'JURISDICTION', message: 'source jurisdiction unsupported' };
  }
  if (!profile.destinationJurisdictions.includes(facts.destinationJurisdiction)) {
    return { code: 'JURISDICTION', message: 'destination jurisdiction unsupported' };
  }
  if (facts.amount.minorUnits < profile.minimumAmount.minorUnits || facts.amount.minorUnits > profile.maximumAmount.minorUnits) {
    return { code: 'AMOUNT_LIMIT', message: 'amount outside rail candidate limits' };
  }
  return null;
}

export function scoreOnlyAfterHardFilters(
  candidates: readonly PaymentRoute[],
  constraints: RouteHardConstraints,
  facts: CandidateRouteFacts,
  profile: PaymentRailProviderCandidateProfile,
): RouteSelection {
  const hard = hardEligibilityFilters(facts, profile);
  if (hard) {
    return Object.freeze({
      chosen: null,
      rejected: Object.freeze(candidates.map((route) => ({ routeId: route.routeId, reason: hard.code }))),
    });
  }
  return selectRoute(candidates, constraints);
}

export type ProviderFailoverPlan = {
  readonly fromProviderId: string;
  readonly toProviderId: string;
  readonly beneficiaryUnchanged: true;
  readonly currencyUnchanged: true;
  readonly purposeUnchanged: true;
  readonly complianceBypassed: false;
  readonly credentialReused: false;
  readonly bothIndependentlyEligible: boolean;
};

export function planProviderFailover(input: {
  readonly from: PaymentRailProviderCandidateProfile;
  readonly to: PaymentRailProviderCandidateProfile;
  readonly fromEligible: boolean;
  readonly toEligible: boolean;
  readonly beneficiaryId: string;
  readonly nextBeneficiaryId: string;
  readonly currency: string;
  readonly nextCurrency: string;
  readonly purpose: string;
  readonly nextPurpose: string;
  readonly fromCredentialHref: string;
  readonly toCredentialHref: string;
}): ProviderFailoverPlan | { readonly ok: false; readonly reason: string } {
  if (input.beneficiaryId !== input.nextBeneficiaryId) {
    return { ok: false, reason: 'failover_must_not_change_beneficiary' };
  }
  if (input.currency !== input.nextCurrency) {
    return { ok: false, reason: 'failover_must_not_change_currency' };
  }
  if (input.purpose !== input.nextPurpose) {
    return { ok: false, reason: 'failover_must_not_change_purpose' };
  }
  if (input.fromCredentialHref === input.toCredentialHref) {
    return { ok: false, reason: 'failover_must_not_reuse_wrong_credential' };
  }
  if (!input.fromEligible || !input.toEligible) {
    return { ok: false, reason: 'failover_requires_independent_eligibility' };
  }
  void input.from;
  void input.to;
  return Object.freeze({
    fromProviderId: input.from.providerId,
    toProviderId: input.to.providerId,
    beneficiaryUnchanged: true,
    currencyUnchanged: true,
    purposeUnchanged: true,
    complianceBypassed: false,
    credentialReused: false,
    bothIndependentlyEligible: true,
  });
}

export type InternationalTransferCandidatePlan = {
  readonly senderCurrency: 'USD';
  readonly recipientCurrency: 'SAR';
  readonly fxQuoteId: string;
  readonly outboundRailProviderId: string;
  readonly bankingProviderId: string;
  readonly sunreyHoldsNamedNetworkLicense: false;
  readonly partnerRelationshipClass: 'EXTERNAL_EVIDENCE';
};

export function internationalUsdToSarPlan(input: {
  readonly banking: BankingProviderCandidateProfile;
  readonly rail: PaymentRailProviderCandidateProfile;
  readonly quote: CandidateFxQuote;
  readonly now: UtcInstant;
}): InternationalTransferCandidatePlan | { readonly ok: false; readonly reason: string } {
  if (candidateQuoteIsExpired(input.quote, input.now)) {
    return { ok: false, reason: 'expired_quote_cannot_execute' };
  }
  if (input.quote.pair.base !== 'USD' || input.quote.pair.quote !== 'SAR') {
    return { ok: false, reason: 'currency_mismatch' };
  }
  return Object.freeze({
    senderCurrency: 'USD',
    recipientCurrency: 'SAR',
    fxQuoteId: input.quote.providerQuoteId,
    outboundRailProviderId: input.rail.providerId,
    bankingProviderId: input.banking.providerId,
    sunreyHoldsNamedNetworkLicense: false,
    partnerRelationshipClass: 'EXTERNAL_EVIDENCE',
  });
}

export function treasuryMayAdviseNotOverride(advice: TreasuryRouteAdvice | null, kernelAllowed: boolean): boolean {
  if (!kernelAllowed) {
    return false;
  }
  void advice;
  return true;
}

export function exposeProviderLiquidityToTreasury(balance: ProviderOperationalBalance): {
  readonly evidence: ProviderOperationalBalance;
  readonly overridesKernel: false;
  readonly overridesCorridor: false;
  readonly overridesProviderAcceptance: false;
  readonly overridesPaymentAuthorization: false;
} {
  return Object.freeze({
    evidence: balance,
    overridesKernel: false,
    overridesCorridor: false,
    overridesProviderAcceptance: false,
    overridesPaymentAuthorization: false,
  });
}

export function baasReferenceIsNotLedgerBalance(reference: BaasAccountReference): true {
  return reference.isCanonicalLedgerBalance === false;
}

export function inboundNoticeIsNotAutomaticCredit(notice: InboundRailNotice, authenticated: boolean, mapped: boolean, complianceAllowed: boolean, authorized: boolean): {
  readonly creditCustomer: false | true;
  readonly reason: string;
} {
  if (!authenticated || !mapped || !complianceAllowed || !authorized) {
    return { creditCustomer: false, reason: 'inbound_requires_authenticity_mapping_compliance_and_authorization' };
  }
  void notice;
  return { creditCustomer: false, reason: 'inbound_still_requires_existing_financial_state_path' };
}

export function mapInboundNotice(notice: InboundRailNotice, receivedAt: UtcInstant, payloadHash: string): InboundRailPayment {
  return freezeInbound({
    inboundId: asInboundPaymentId(notice.inboundId),
    provider: notice.provider,
    rail: notice.rail,
    amount: notice.amount,
    currency: notice.amount.currency,
    destinationAccountId: null,
    destinationCustomerId: null,
    destinationReference: asOpaqueAccountRef(notice.destinationReference),
    sourceReference: asOpaqueAccountRef(notice.sourceReference),
    purposeReference: notice.purposeReference,
    references: notice.references,
    status: 'RECEIVED',
    screeningRef: null,
    journalIds: [],
    receivedAt,
    payloadHash,
  });
}

export function mapProviderReturn(message: RailReturnMessage, originalJournals: readonly string[]): RailReturnRecord & { readonly originalJournalIds: readonly string[]; readonly originalHistoryPreserved: true } {
  return Object.freeze({
    ...freezeReturn({
      paymentId: message.paymentId,
      originalSubmissionId: message.originalSubmissionId,
      reason: normalizeReturnReason(message.reason),
      amount: message.amount,
      references: message.references,
      occurredAt: message.occurredAt,
    }),
    originalJournalIds: Object.freeze([...originalJournals]),
    originalHistoryPreserved: true,
  });
}

export function unknownCorridorPolicy(corridor: PaymentCorridor | undefined): 'RESEARCH_REQUIRED_DISABLED' {
  if (!corridor || !corridorIsSimulationEnabled(corridor) || corridor.policyStatus === 'RESEARCH_REQUIRED') {
    return 'RESEARCH_REQUIRED_DISABLED';
  }
  return 'RESEARCH_REQUIRED_DISABLED';
}

export function liveFlagsRemainOff(): { readonly LIVE_PAYMENTS_ENABLED: false; readonly LIVE_BANKING_RAILS: false } {
  if (LIVE_PAYMENTS_ENABLED !== false || LIVE_BANKING_RAILS !== false) {
    throw new Error('LIVE payment flags must remain false');
  }
  return { LIVE_PAYMENTS_ENABLED: false, LIVE_BANKING_RAILS: false };
}

export function productionCandidatePosture() {
  return Object.freeze({
    ...PRODUCTION_CANDIDATE_FLAGS,
    ...liveFlagsRemainOff(),
  });
}

export function treasuryAdvisorCannotOverrideKernel(advisor: TreasuryAdvisor | null, kernelDecision: 'ALLOW' | 'REFUSE'): 'ALLOW' | 'REFUSE' {
  void advisor;
  return kernelDecision;
}
