import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';
import {
  ProductGrowthService,
  type CreateGrowPlanInput,
  type FinancialProposal,
  type GrowProductFailure,
  type GrowRiskProfile,
  type GrowthProductActor,
  type ProductGrowthPlan,
  isGrowRiskProfile,
} from '../../../../packages/platform/src/growth/product/index.ts';
import { toLovableExperience } from '../../../../packages/platform/src/growth/product/lovable-contract.ts';

export { toLovableExperience };

export function actorFromPrincipal(principal: BffPrincipal, kind: 'HUMAN' | 'AGENT' = 'HUMAN'): GrowthProductActor {
  return {
    actorId: principal.actorId,
    subjectId: principal.customerId,
    capabilities: principal.capabilities,
    jurisdiction: principal.jurisdiction,
    verification: principal.verification,
    restricted: principal.restricted,
    principalKind: kind,
    authenticationStrength: 'STANDARD',
  };
}

export function mapGrowFailure(error: GrowProductFailure, requestId: string): BffErrorEnvelope {
  const code =
    error.code === 'CROSS_USER_DENIED' || error.code === 'CAPABILITY_DENIED'
      ? 'RESOURCE_NOT_OWNED'
      : error.code === 'STEP_UP_REQUIRED'
        ? 'STEP_UP_REQUIRED'
        : error.code === 'POLICY_DENIED' || error.code === 'SUITABILITY_DENIED' || error.code === 'AGENT_CANNOT_APPROVE'
          ? 'KERNEL_DENIED'
          : error.code === 'PLAN_NOT_FOUND' || error.code === 'PROPOSAL_NOT_FOUND' || error.code === 'FABRICATED_PROPOSAL_ID'
            ? 'NOT_FOUND'
            : error.code === 'EXPIRED'
              ? 'VALIDATION'
              : 'VALIDATION';
  const category =
    code === 'RESOURCE_NOT_OWNED' || code === 'KERNEL_DENIED' || code === 'STEP_UP_REQUIRED'
      ? 'AUTHORIZATION'
      : code === 'NOT_FOUND'
        ? 'NOT_FOUND'
        : 'VALIDATION';
  return bffError({
    errorCode: code,
    category,
    message: error.message,
    retryable: false,
    requestId,
    detailsSafeForClient: { growCode: error.code },
  });
}

export function parseCreatePlan(principal: BffPrincipal, body: Record<string, unknown>): CreateGrowPlanInput | BffErrorEnvelope {
  const currency = typeof body.currency === 'string' ? body.currency : 'USD';
  const starting = stringifyMinor(body.startingCapitalMinorUnits ?? body.iHaveMinorUnits ?? body.startingCapital);
  const horizon = Number(body.timeHorizonMonths ?? body.horizonMonths);
  const risk = body.riskProfile ?? body.risk;
  if (!starting || !Number.isInteger(horizon) || !isGrowRiskProfile(risk)) {
    return bffError({
      errorCode: 'VALIDATION',
      category: 'VALIDATION',
      message: 'starting capital, timeHorizonMonths, and riskProfile are required',
      retryable: false,
      requestId: 'req_grow_validate',
    });
  }
  const goal = stringifyMinor(body.goalTargetMinorUnits ?? body.myGoalMinorUnits);
  const liquidity = stringifyMinor(body.liquidityRequirementMinorUnits);
  const recurring = stringifyMinor(body.recurringContributionMinorUnits);
  return {
    ownerId: principal.customerId,
    startingCapitalMinorUnits: starting,
    currency,
    timeHorizonMonths: horizon,
    riskProfile: risk,
    ...(goal ? { goalTargetMinorUnits: goal } : {}),
    ...(Array.isArray(body.goalRefs) ? { goalRefs: body.goalRefs.filter((item): item is string => typeof item === 'string') } : {}),
    ...(liquidity ? { liquidityRequirementMinorUnits: liquidity } : {}),
    ...(recurring ? { recurringContributionMinorUnits: recurring } : {}),
    ...(typeof body.sourceAccountId === 'string' ? { sourceAccountId: body.sourceAccountId } : {}),
    ...(typeof body.opportunityId === 'string' ? { opportunityId: body.opportunityId } : {}),
  };
}

export function growCatalog(service: ProductGrowthService, principal: BffPrincipal, requestId: string) {
  const actor = actorFromPrincipal(principal);
  const plans = service.listPlans(actor, principal.customerId);
  const items = plans.ok ? plans.value : [];
  const latest = items[0];
  return {
    group: 'grow',
    schema: 'sunrey.consumer.grow.v1',
    availability: 'AVAILABLE_SIMULATION',
    state: 'SIMULATION_ONLY',
    reason: 'Grow My Money plans and proposals are simulation illustrations. Production remains disabled.',
    productionActive: false,
    guaranteedOutcome: false,
    requestId,
    items,
    ...(latest ? { experience: toLovableExperience(latest) } : {}),
  };
}

export function publicPlan(plan: ProductGrowthPlan): ProductGrowthPlan {
  return plan;
}

export function publicProposal(proposal: FinancialProposal): FinancialProposal {
  return proposal;
}

function stringifyMinor(value: unknown): string | undefined {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'object' && value !== null && 'minorUnits' in value) {
    const minor = (value as { minorUnits: unknown }).minorUnits;
    if (typeof minor === 'string' && /^\d+$/.test(minor)) return minor;
  }
  return undefined;
}
