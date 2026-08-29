/**
 * Deterministic Access Economy allocation.
 *
 * The allocator answers one question per request: may this person hold this
 * many productive units of this experience, in this place, on this date?
 * It never prices access in a new unit, never issues a native asset, and
 * never approves anything an agent proposed on its own behalf.
 *
 * Refusal is a first-class correct outcome.
 */

import { AccessEntitlementEngine } from '../../../access-fabric/src/index.ts';
import type { AccessEntitlementEngineInput } from '../../../access-fabric/src/index.ts';
import { ACCESS_CANONICAL_INTEGRATIONS, type AccessDecisionOutcome } from './ids.ts';
import { brandAccessEntitlementId } from './branding.ts';
import { simInstant } from './capacity.ts';
import type { AccessSimulationEvidence } from './evidence.ts';
import type {
  AccessCapacityLedgerRow,
  AccessCapacityPool,
  AccessDecision,
  AccessEconomyScenario,
  AccessPolicyChange,
  AccessRequest,
} from './types.ts';

type PoolState = {
  readonly pool: AccessCapacityPool;
  reservedUnits: bigint;
  confirmedUnits: bigint;
};

type Resolution = {
  readonly outcome: AccessDecisionOutcome;
  readonly reasonCode: string;
  readonly grantedUnits: bigint;
  readonly settlementOwner: string | null;
  readonly payload: Record<string, unknown>;
};

export type AllocationOutcome = {
  readonly decisions: readonly AccessDecision[];
  readonly capacity: readonly AccessCapacityLedgerRow[];
  readonly policyChanges: readonly AccessPolicyChange[];
  readonly grantedUnits: bigint;
  readonly oversoldUnits: bigint;
  readonly entitlementEvaluations: number;
  readonly entitlementEngineRefusals: number;
};

/**
 * Deterministic queue order: policy priority band, then request id. Never a
 * ranking derived from the person.
 */
function queueOrder(left: AccessRequest, right: AccessRequest): number {
  if (left.policyPriorityBand !== right.policyPriorityBand) {
    return left.policyPriorityBand - right.policyPriorityBand;
  }
  return left.requestId < right.requestId ? -1 : left.requestId > right.requestId ? 1 : 0;
}

function remainingUnits(state: PoolState): bigint {
  const committed = state.pool.preCommittedUnits + state.reservedUnits + state.confirmedUnits;
  const remaining = state.pool.publishedUnits - committed;
  return remaining > 0n ? remaining : 0n;
}

/**
 * The canonical entitlement engine in packages/access-fabric — not this
 * simulator — decides what a subject is currently eligible to request.
 */
function entitlementEngineAllows(request: AccessRequest, pool: AccessCapacityPool): boolean {
  const engine = new AccessEntitlementEngine();
  const entitlementId = brandAccessEntitlementId(request.entitlementId);
  const input: AccessEntitlementEngineInput = {
    subjectId: request.subjectId,
    evaluatedAt: request.submittedAt,
    entitlements: Object.freeze([
      {
        entitlementId,
        subjectId: request.subjectId,
        category: pool.experienceClass,
        capacity: request.entitlementCapacityUnits,
        startAt: simInstant(-1_440),
        endAt: simInstant(43_200),
        jurisdiction: request.jurisdiction,
        geographicScope: pool.locationId,
        purpose: request.purpose,
        restrictions: Object.freeze([]),
        expiry: simInstant(43_200),
        replenishment: {
          kind: 'FIXED_WINDOW',
          windowStartAt: simInstant(-1_440),
          windowEndAt: simInstant(43_200),
          quantityPerWindow: request.entitlementCapacityUnits,
        },
        provenance: 'PURCHASED',
        transferability: false,
        humanWorthScore: false,
        isMonetaryAsset: false,
        isTransferableBalance: false,
      },
    ]),
    mandates: Object.freeze([]),
    policyEligibility: Object.freeze([
      {
        entitlementId,
        eligible: request.legalEligibility === 'ELIGIBLE',
        policyRef: 'rdt.simulation.access-economy.v1',
        evaluatedAt: request.submittedAt,
        reasonCode: request.legalEligibility,
      },
    ]),
    usage: Object.freeze([]),
    reservations: Object.freeze([]),
    jurisdictionCapability: {
      actorJurisdiction: request.jurisdiction,
      permittedJurisdictions: Object.freeze([request.jurisdiction]),
      geographicScopes: Object.freeze([pool.locationId]),
    },
  };
  const evaluated = engine.evaluate(input);
  if (!evaluated.ok) {
    return false;
  }
  const eligible = evaluated.value.envelope.eligibleRequests[0];
  return eligible !== undefined && eligible.remainingCapacity >= request.quantity;
}

function decisionRecord(
  request: AccessRequest,
  resolution: Resolution,
  evidenceSeq: string,
): AccessDecision {
  return Object.freeze({
    requestId: request.requestId,
    subjectId: request.subjectId,
    poolId: request.poolId,
    requestedUnits: request.quantity,
    grantedUnits: resolution.grantedUnits,
    outcome: resolution.outcome,
    reasonCode: resolution.reasonCode,
    decidedAt: request.submittedAt,
    authorityRef: request.authority?.authorityRef ?? null,
    origin: request.origin,
    evidenceSeq,
    settlementOwner: resolution.settlementOwner,
    humanWorthScore: false,
  });
}

function basePayload(request: AccessRequest): Record<string, unknown> {
  return {
    requestId: request.requestId,
    subjectId: request.subjectId,
    poolId: request.poolId,
    requestedUnits: request.quantity.toString(),
    origin: request.origin,
    humanWorthScore: false,
  };
}

function refuse(request: AccessRequest, outcome: AccessDecisionOutcome, reasonCode: string): Resolution {
  return {
    outcome,
    reasonCode,
    grantedUnits: 0n,
    settlementOwner: null,
    payload: { ...basePayload(request), outcome, reasonCode },
  };
}

type AllocationContext = {
  readonly pricingUnavailable: boolean;
  readonly settlementFails: boolean;
  readonly policyChangeIndex: number;
  entitlementEvaluations: number;
  entitlementEngineRefusals: number;
};

function resolveRequest(
  request: AccessRequest,
  state: PoolState | undefined,
  index: number,
  context: AllocationContext,
): Resolution {
  if (request.agentSelfApprovalAttempted) {
    return refuse(request, 'REFUSED_AI_SELF_APPROVAL', 'an agent proposal cannot authorize itself');
  }
  if (request.legalEligibility === 'UNDETERMINED') {
    return refuse(
      request,
      'REFUSED_ELIGIBILITY_UNDETERMINED',
      'legal eligibility is not inferred when the policy plane is silent',
    );
  }
  if (request.legalEligibility === 'INELIGIBLE') {
    return refuse(request, 'REFUSED_NOT_ELIGIBLE', 'policy plane returned INELIGIBLE');
  }
  if (!state) {
    return refuse(request, 'REFUSED_PROVIDER_UNAVAILABLE', 'no published capacity pool for this request');
  }
  if (!state.pool.providerAvailable) {
    return refuse(request, 'REFUSED_PROVIDER_UNAVAILABLE', 'provider is unavailable for this bucket');
  }
  if (state.pool.evidenceStale) {
    return refuse(request, 'REFUSED_STALE_EVIDENCE', 'capacity evidence is stale, so capacity is not assumed');
  }
  if (context.pricingUnavailable) {
    return refuse(
      request,
      'REFUSED_PRICING_UNAVAILABLE',
      'canonical Exchange quote unavailable and no fallback price is invented',
    );
  }
  if (!request.authority || !request.authority.verifiedByCanonicalKernel) {
    return refuse(request, 'REFUSED_NO_EXECUTION_AUTHORITY', 'no verified Execution Authority for this reservation');
  }

  context.entitlementEvaluations += 1;
  if (!entitlementEngineAllows(request, state.pool)) {
    context.entitlementEngineRefusals += 1;
    return refuse(request, 'REFUSED_NOT_ELIGIBLE', 'canonical access entitlement engine returned no eligible request');
  }

  if (remainingUnits(state) < request.quantity) {
    return refuse(
      request,
      'REFUSED_CAPACITY_EXHAUSTED',
      'remaining published capacity is below the requested quantity',
    );
  }

  state.reservedUnits += request.quantity;

  if (context.policyChangeIndex >= 0 && index >= context.policyChangeIndex) {
    return {
      outcome: 'HELD_FOR_POLICY_REVIEW',
      reasonCode: 'reservation opened after a policy change and awaits re-evaluation',
      grantedUnits: 0n,
      settlementOwner: null,
      payload: {
        ...basePayload(request),
        outcome: 'HELD_FOR_POLICY_REVIEW',
        reasonCode: 'policy change pending review',
      },
    };
  }

  if (context.settlementFails && index % 3 === 0) {
    state.reservedUnits -= request.quantity;
    return {
      outcome: 'REFUSED_SETTLEMENT_FAILED',
      reasonCode: 'canonical ledger and custody settlement did not complete, so the reservation was released',
      grantedUnits: 0n,
      settlementOwner: ACCESS_CANONICAL_INTEGRATIONS.ledger,
      payload: {
        ...basePayload(request),
        outcome: 'REFUSED_SETTLEMENT_FAILED',
        reasonCode: 'settlement did not complete',
        settlementOwner: ACCESS_CANONICAL_INTEGRATIONS.ledger,
      },
    };
  }

  state.reservedUnits -= request.quantity;
  state.confirmedUnits += request.quantity;
  return {
    outcome: 'CONFIRMED',
    reasonCode: 'reservation confirmed against published productive capacity',
    grantedUnits: request.quantity,
    settlementOwner: ACCESS_CANONICAL_INTEGRATIONS.ledger,
    payload: {
      ...basePayload(request),
      outcome: 'CONFIRMED',
      grantedUnits: request.quantity.toString(),
      authorityRef: request.authority.authorityRef,
      settlementOwner: ACCESS_CANONICAL_INTEGRATIONS.ledger,
    },
  };
}

export function allocate(
  scenario: AccessEconomyScenario,
  pools: readonly AccessCapacityPool[],
  requests: readonly AccessRequest[],
  evidence: AccessSimulationEvidence,
): AllocationOutcome {
  const states = new Map<string, PoolState>(
    pools.map((pool) => [pool.poolId, { pool, reservedUnits: 0n, confirmedUnits: 0n }]),
  );
  const ordered = [...requests].sort(queueOrder);
  const context: AllocationContext = {
    pricingUnavailable: scenario.shocks.includes('ACCESS_EXCHANGE_UNAVAILABLE'),
    settlementFails: scenario.shocks.includes('ACCESS_SETTLEMENT_FAILURE'),
    policyChangeIndex: scenario.shocks.includes('ACCESS_POLICY_CHANGE_MID_RESERVATION')
      ? Math.trunc(ordered.length / 2)
      : -1,
    entitlementEvaluations: 0,
    entitlementEngineRefusals: 0,
  };

  const decisions: AccessDecision[] = [];
  const policyChanges: AccessPolicyChange[] = [];
  let grantedUnits = 0n;
  let confirmedAtPolicyChange = 0;

  ordered.forEach((request, index) => {
    if (index === context.policyChangeIndex) {
      confirmedAtPolicyChange = decisions.filter((row) => row.outcome === 'CONFIRMED').length;
      const change: AccessPolicyChange = Object.freeze({
        policyRef: 'rdt.simulation.access-economy.v2',
        appliedAt: simInstant(index),
        affectedPoolIds: Object.freeze(pools.map((pool) => pool.poolId)),
        confirmedRightsHonoured: true,
        pendingReservationsHeld: 0,
        note: 'stricter policy version applied mid-run; already-confirmed rights are honoured',
      });
      evidence.seal('access.policy.changed', change, true);
      policyChanges.push(change);
    }

    const resolution = resolveRequest(request, states.get(request.poolId), index, context);
    const record = evidence.seal('access.request.decided', resolution.payload, true);
    decisions.push(decisionRecord(request, resolution, record.seq));
    grantedUnits += resolution.grantedUnits;
  });

  if (policyChanges.length > 0) {
    const first = policyChanges[0]!;
    const confirmedAfter = decisions.filter((row) => row.outcome === 'CONFIRMED').length;
    policyChanges[0] = Object.freeze({
      ...first,
      pendingReservationsHeld: decisions.filter((row) => row.outcome === 'HELD_FOR_POLICY_REVIEW').length,
      confirmedRightsHonoured: confirmedAfter === confirmedAtPolicyChange,
    });
  }

  let oversoldUnits = 0n;
  const capacity = pools.map((pool) => {
    const state = states.get(pool.poolId)!;
    const committed = pool.preCommittedUnits + state.reservedUnits + state.confirmedUnits;
    const remaining = pool.publishedUnits - committed;
    const oversold = remaining < 0n ? -remaining : 0n;
    oversoldUnits += oversold;
    return Object.freeze({
      poolId: pool.poolId,
      publishedUnits: pool.publishedUnits,
      reservedUnits: state.reservedUnits,
      confirmedUnits: state.confirmedUnits,
      committedUnits: committed,
      remainingUnits: remaining > 0n ? remaining : 0n,
      oversoldUnits: oversold,
    });
  });

  return Object.freeze({
    decisions: Object.freeze(decisions),
    capacity: Object.freeze(capacity),
    policyChanges: Object.freeze(policyChanges),
    grantedUnits,
    oversoldUnits,
    entitlementEvaluations: context.entitlementEvaluations,
    entitlementEngineRefusals: context.entitlementEngineRefusals,
  });
}
