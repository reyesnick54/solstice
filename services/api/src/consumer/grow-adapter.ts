import { GrowthOrchestrator } from '../../../../packages/platform/src/service.ts';
import type { OpportunityDiscoveryContext } from '../../../../packages/platform/src/growth/opportunity/types.ts';
import { SIMULATION_GROWTH_PRODUCTS, SIMULATION_RATE_CATALOG } from '../../../../packages/platform/src/growth/opportunity/products.ts';
import { simulationPolicyPort } from '../../../../packages/platform/src/policy-port.ts';
import type { BffErrorEnvelope } from './errors.ts';
import { bffError } from './errors.ts';
import type { AccountsReadPort, BffPrincipal, OptionalDomainPort, OptionalDomainSummary } from './ports.ts';
import type { Opportunity } from '../../../../packages/platform/src/growth/opportunity/types.ts';

export type GrowOpportunityPort = OptionalDomainPort & {
  list(principal: BffPrincipal): unknown | BffErrorEnvelope;
  get(principal: BffPrincipal, opportunityId: string): unknown | BffErrorEnvelope;
  dismiss(principal: BffPrincipal, opportunityId: string): unknown | BffErrorEnvelope;
  startProposal(principal: BffPrincipal, opportunityId: string): unknown | BffErrorEnvelope;
};

function contextFrom(principal: BffPrincipal, accounts: AccountsReadPort): Partial<OpportunityDiscoveryContext> {
  const positions = accounts.listAccounts(principal.customerId).map((account) => {
    const position = accounts.positionOf(account);
    const minor =
      'unavailable' in position ? '0' : position.available.minorUnits.toString();
    return {
      accountRef: account.id,
      currency: account.currency,
      minorUnits: minor,
      accountClass: account.accountClass,
      restricted: principal.restricted,
      frozen: account.status === 'FROZEN',
    };
  });
  const products = SIMULATION_GROWTH_PRODUCTS.map((item) =>
    principal.restricted ? { ...item, available: false, providerAvailable: false } : item,
  );
  return {
    jurisdiction: principal.jurisdiction,
    kycState:
      principal.verification === 'VERIFIED'
        ? 'VERIFIED'
        : principal.restricted
          ? 'RESTRICTED'
          : principal.verification === 'IN_PROGRESS'
            ? 'PENDING'
            : 'UNVERIFIED',
    customerRestricted: principal.restricted,
    riskProfile: principal.risk === 'ELEVATED' ? 'GROWTH' : principal.risk === 'LOW' ? 'CONSERVATIVE' : 'BALANCED',
    suitabilityMaxRisk: principal.risk === 'ELEVATED' ? 'HIGH' : principal.risk === 'LOW' ? 'LOW' : 'MODERATE',
    products,
    ledgerPositions: Object.freeze(positions),
    rateCatalog: SIMULATION_RATE_CATALOG,
    policy: simulationPolicyPort,
  };
}

function failureMessage(error: { readonly code: string; readonly message?: string }): string {
  return error.message ?? error.code;
}

function mapFailure(code: string, message: string, requestId: string): BffErrorEnvelope {
  if (code === 'CROSS_USER_DENIED' || code === 'SUBJECT_MISMATCH' || code === 'CAPABILITY_DENIED') {
    return bffError({
      errorCode: 'RESOURCE_NOT_OWNED',
      category: 'AUTHORIZATION',
      message,
      retryable: false,
      requestId,
    });
  }
  if (code === 'OPPORTUNITY_NOT_FOUND') {
    return bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message,
      retryable: false,
      requestId,
    });
  }
  return bffError({
    errorCode: 'VALIDATION',
    category: 'VALIDATION',
    message,
    retryable: false,
    requestId,
  });
}

function publicOpportunity(item: Opportunity): unknown {
  return Object.freeze({
    opportunityId: item.opportunityId,
    type: item.type,
    title: item.title,
    summary: item.summary,
    source: item.source,
    eligible: item.eligible,
    priority: item.priority,
    estimatedImpact: item.estimatedImpact ?? null,
    impactRange: item.impactRange ?? null,
    impactKind: item.impact.kind,
    assumptions: item.impact.assumptions,
    rateSource: item.impact.rateSource ?? null,
    taxDisclaimer: item.impact.taxDisclaimer,
    riskLevel: item.riskLevel,
    liquidityImpact: item.liquidityImpact,
    timeHorizon: item.timeHorizon,
    fees: item.fees,
    dependencies: item.dependencies,
    goalLinks: item.goalLinks,
    evidence: { detector: item.evidence.detector, notes: item.evidence.notes },
    expiresAt: item.expiresAt,
    status: item.status,
    immediatelyExecutable: false,
    achievementPromised: false,
    returnGuaranteed: false,
    productionMoneyMovement: false,
  });
}

export function createGrowOpportunityPort(input: {
  readonly orchestrator: GrowthOrchestrator;
  readonly accounts: AccountsReadPort;
  readonly actorFor: (principal: BffPrincipal) => unknown;
  readonly requestId?: string;
}): GrowOpportunityPort {
  const requestId = input.requestId ?? 'grow';
  return {
    summarize(principal): OptionalDomainSummary {
      const listed = input.orchestrator.listOpportunities(
        input.actorFor(principal),
        principal.identityId,
        contextFrom(principal, input.accounts),
      );
      const count = listed.ok ? listed.value.cards.length : 0;
      return Object.freeze({
        availability: 'AVAILABLE_SIMULATION',
        state: 'SIMULATION_ONLY',
        provider: 'SIMULATED',
        reason: 'Growth opportunities are simulation reviews, not executable investments',
        count,
      });
    },
    list(principal) {
      const listed = input.orchestrator.listOpportunities(
        input.actorFor(principal),
        principal.identityId,
        contextFrom(principal, input.accounts),
      );
      if (!listed.ok) {
        return mapFailure(listed.error.code, failureMessage(listed.error), requestId);
      }
      return Object.freeze({
        schema: listed.value.schema,
        generatedAt: listed.value.generatedAt,
        rankingVersion: listed.value.rankingVersion,
        productionMoneyMovement: false,
        items: listed.value.cards.map((card) =>
          Object.freeze({
            ...card,
            productionMoneyMovement: false,
          }),
        ),
        opportunities: listed.value.items.map(publicOpportunity),
        suppressedCount: listed.value.suppressedCount,
      });
    },
    get(principal, opportunityId) {
      const found = input.orchestrator.getOpportunity(input.actorFor(principal), principal.identityId, opportunityId);
      if (!found.ok) {
        return mapFailure(found.error.code, failureMessage(found.error), requestId);
      }
      return publicOpportunity(found.value);
    },
    dismiss(principal, opportunityId) {
      const dismissed = input.orchestrator.dismissOpportunity(
        input.actorFor(principal),
        principal.identityId,
        opportunityId,
      );
      if (!dismissed.ok) {
        return mapFailure(dismissed.error.code, failureMessage(dismissed.error), requestId);
      }
      return publicOpportunity(dismissed.value);
    },
    startProposal(principal, opportunityId) {
      const started = input.orchestrator.startOpportunityProposal(
        input.actorFor(principal),
        principal.identityId,
        opportunityId,
      );
      if (!started.ok) {
        return mapFailure(started.error.code, failureMessage(started.error), requestId);
      }
      return Object.freeze({
        ...started.value,
        productionMoneyMovement: false,
      });
    },
  };
}
