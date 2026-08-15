import type { UtcInstant } from '../../domain/src/time.ts';
import type { PolicyRegistry, PolicyVersionRecord } from '../../kernel/src/policy/index.ts';
import { compareCurrentVsCandidate } from './compare.ts';
import { classified } from './facts.ts';
import { asRegulatoryScenarioId, type CandidatePolicySetId, type RegulatorySnapshotId } from './ids.ts';
import type { GrowthImpactState } from './taxonomy.ts';
import type { GrowthPlanImpact, RegulatoryScenario } from './types.ts';

const CATEGORY_TO_ACTION: Record<string, string> = {
  REVIEW_SUBSCRIPTION: 'POST_WITHDRAWAL',
  REDUCE_FEE: 'POST_FEE',
  ALLOCATE_TO_EMERGENCY_RESERVE: 'INTERNAL_TRANSFER',
  REDUCE_DEBT: 'POST_WITHDRAWAL',
  OPTIMIZE_PAYMENT_TIMING: 'INITIATE_PAYMENT',
  CAPTURE_REWARD: 'POST_DEPOSIT',
  MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS: 'INTERNAL_TRANSFER',
  REVIEW_INVESTMENT_OPPORTUNITY_FUTURE: 'OPEN_ACCOUNT',
};

function impactState(decision: string): GrowthImpactState {
  if (decision === 'BLOCK') return 'BECOME_BLOCKED';
  if (decision === 'REQUIRE_MANUAL_REVIEW') return 'REQUIRE_REVIEW';
  if (decision === 'DEFER' || decision === 'INSUFFICIENT_FACTS') return 'BECOME_UNSUPPORTED';
  return 'REMAIN_PERMITTED';
}

export function assessGrowthPlanImpact(input: {
  readonly productionRegistry: PolicyRegistry;
  readonly candidateVersions: readonly PolicyVersionRecord[];
  readonly baselineSnapshotId: RegulatorySnapshotId;
  readonly candidateSetId: CandidatePolicySetId;
  readonly planRef: string;
  readonly actionCategories: readonly string[];
  readonly at: UtcInstant;
}): GrowthPlanImpact {
  const categories = input.actionCategories.map((actionCategory) => {
    const actionType = CATEGORY_TO_ACTION[actionCategory] ?? 'OPEN_ACCOUNT';
    const scenario: RegulatoryScenario = {
      scenarioId: asRegulatoryScenarioId(`rsc_growth_${actionCategory.toLowerCase()}`),
      name: `growth:${actionCategory}`,
      category: actionCategory === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE' ? 'INVESTMENT_PLACEHOLDER' : 'GROWTH_PLAN',
      createdAt: input.at,
      facts: {
        jurisdiction: classified('US', 'SYNTHETIC_FACT'),
        actorId: classified('rdt_growth_actor', 'SYNTHETIC_FACT'),
        customerId: classified('cus_rdt_growth', 'SYNTHETIC_FACT'),
        customerStatus: classified('ACTIVE', 'SYNTHETIC_FACT'),
        kycState: classified('VERIFIED', 'SYNTHETIC_FACT'),
        kycRecordVersion: classified(2, 'SYNTHETIC_FACT'),
        productId: classified('prod_demand_usd_us', 'SYNTHETIC_FACT'),
        legalEntityId: classified('le_solstice_us_inc', 'SYNTHETIC_FACT'),
        actionType: classified(actionType, 'SYNTHETIC_FACT'),
        corridorId: classified('US-SA-USD-SAR', 'SYNTHETIC_FACT'),
        corridorSimulationEnabled: classified(true, 'SYNTHETIC_FACT'),
        sanctionsHit: classified(false, 'SYNTHETIC_FACT'),
        pepHit: classified(false, 'SYNTHETIC_FACT'),
        fraudHold: classified(false, 'SYNTHETIC_FACT'),
      },
      hypotheticalOverrides: Object.freeze([]),
      invariant: false,
    };
    if (actionCategory === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE') {
      return Object.freeze({
        actionCategory,
        state: 'BECOME_UNSUPPORTED' as const,
        currentDecision: 'INSUFFICIENT_FACTS' as const,
        candidateDecision: 'INSUFFICIENT_FACTS' as const,
      });
    }
    const comparison = compareCurrentVsCandidate({
      productionRegistry: input.productionRegistry,
      scenario,
      candidateVersions: input.candidateVersions,
      baselineSnapshotId: input.baselineSnapshotId,
      candidateSetId: input.candidateSetId,
      at: input.at,
    });
    return Object.freeze({
      actionCategory,
      state: impactState(comparison.candidate.decisionClass),
      currentDecision: comparison.current.decisionClass,
      candidateDecision: comparison.candidate.decisionClass,
    });
  });
  return Object.freeze({
    planRef: input.planRef,
    evaluatedAt: input.at,
    categories: Object.freeze(categories),
    simulationOnly: true,
  });
}

export function estimatePeveImpact(input: {
  readonly growthImpact: GrowthPlanImpact;
  readonly opportunityRefs: readonly string[];
}): {
  readonly status: 'DEPENDENCY_NOT_IMPLEMENTED' | 'HYPOTHETICAL_IMPACT';
  readonly impactedOpportunityRefs: readonly string[];
  readonly label: 'HYPOTHETICAL';
  readonly note: string;
} {
  const feeSavingBlocked = input.growthImpact.categories.some(
    (row) =>
      (row.actionCategory === 'REDUCE_FEE' || row.actionCategory === 'REVIEW_SUBSCRIPTION') &&
      row.state !== 'REMAIN_PERMITTED',
  );
  if (input.opportunityRefs.length === 0) {
    return Object.freeze({
      status: 'DEPENDENCY_NOT_IMPLEMENTED',
      impactedOpportunityRefs: Object.freeze([]),
      label: 'HYPOTHETICAL',
      note: 'Personal Economic Value Engine is PARTIAL and is not rewritten by the Regulatory Digital Twin.',
    });
  }
  return Object.freeze({
    status: feeSavingBlocked ? 'HYPOTHETICAL_IMPACT' : 'DEPENDENCY_NOT_IMPLEMENTED',
    impactedOpportunityRefs: Object.freeze(feeSavingBlocked ? [...input.opportunityRefs] : []),
    label: 'HYPOTHETICAL',
    note: 'Hypothetical PEVE impact only. Historical PEVE records are not rewritten.',
  });
}
