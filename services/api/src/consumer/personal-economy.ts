/**
 * ACCESS-20 Consumer BFF — unified Personal Economy Agent views.
 * Orchestration only. Proposals remain non-executable until human approval.
 */

import type { Clock } from '../../../../packages/config/src/clock.ts';
import type { EconomicGraphService } from '../../../../packages/personal-economic-graph/src/service.ts';
import type { GrowthOrchestrator } from '../../../../packages/platform/src/service.ts';
import {
  PersonalEconomyService,
  SIMULATION_DISCLAIMER,
  parseScenarioKind,
  type PersonalEconomyConstraints,
  type PersonalEconomyRiskProfile,
  type PersonalEconomyScenarioInput,
  type PersonalEconomySnapshotPorts,
} from '../../../../packages/platform/src/personal-economy/index.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export type PersonalEconomyBffDeps = {
  readonly peg: EconomicGraphService;
  readonly orchestrator: GrowthOrchestrator;
  readonly clock: Clock;
  readonly resolveActor: (principal: BffPrincipal) => unknown;
  readonly snapshotPortsFor?: (principal: BffPrincipal) => PersonalEconomySnapshotPorts;
  readonly constraintsFor?: (principal: BffPrincipal) => PersonalEconomyConstraints;
};

export class PersonalEconomyBffSurface {
  private readonly service: PersonalEconomyService;
  private readonly deps: PersonalEconomyBffDeps;

  constructor(deps: PersonalEconomyBffDeps) {
    this.deps = deps;
    this.service = new PersonalEconomyService({
      clock: deps.clock,
      peg: deps.peg,
      orchestrator: deps.orchestrator,
    });
  }

  overview(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.deps.resolveActor(principal);
    const snapshot = this.service.buildSnapshot(
      actor,
      principal.identityId,
      this.deps.snapshotPortsFor?.(principal),
    );
    if (!snapshot.ok) {
      return this.fail(requestId, snapshot.error.code, snapshot.error.message);
    }
    return {
      schema: 'sunrey.consumer.personal-economy.overview.v1',
      productionActive: false,
      autoExecution: false,
      guaranteedOutcome: false,
      disclaimer: SIMULATION_DISCLAIMER,
      snapshot: snapshot.value,
      invariants: [
        'AGENT_CANNOT_SELF_APPROVE',
        'AGENT_CANNOT_ISSUE_EXECUTION_AUTHORITY',
        'AGENT_CANNOT_MINT_SR',
        'AGENT_CANNOT_MINT_MR',
        'AGENT_CANNOT_INVENT_ACCESS',
        'AGENT_CANNOT_PROMISE_RETURNS',
      ],
      resultKind: 'PROJECTION',
    };
  }

  plan(principal: BffPrincipal, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.deps.resolveActor(principal);
    const constraints = this.deps.constraintsFor?.(principal);
    const ports = this.deps.snapshotPortsFor?.(principal);
    const built = this.service.buildPlan({
      actor,
      subjectId: principal.identityId,
      ...(constraints ? { constraints } : {}),
      ...(constraints?.maximumInvestmentRisk
        ? { riskProfile: constraints.maximumInvestmentRisk as PersonalEconomyRiskProfile }
        : {}),
      ...(ports ? { ports } : {}),
    });
    if (!built.ok) {
      return this.fail(requestId, built.error.code, built.error.message);
    }
    return {
      schema: 'sunrey.consumer.personal-economy.plan.v1',
      productionActive: false,
      autoExecution: false,
      guaranteedOutcome: false,
      disclaimer: SIMULATION_DISCLAIMER,
      plan: built.value,
      resultKind: 'SIMULATION',
    };
  }

  scenarios(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.deps.resolveActor(principal);
    const constraints = this.deps.constraintsFor?.(principal);
    const ports = this.deps.snapshotPortsFor?.(principal);
    let scenario: string | PersonalEconomyScenarioInput | null = null;
    if (typeof body.scenario === 'string') {
      scenario = body.scenario;
    } else if (typeof body.kind === 'string') {
      const kind = parseScenarioKind(body.kind);
      if (kind) {
        scenario = {
          kind,
          ...(typeof body.amountMinorUnits === 'string' ? { amountMinorUnits: body.amountMinorUnits } : {}),
          ...(typeof body.currency === 'string' ? { currency: body.currency } : {}),
          ...(typeof body.tokenQuantity === 'string' ? { tokenQuantity: body.tokenQuantity } : {}),
          ...(typeof body.holdMonths === 'number' ? { holdMonths: body.holdMonths } : {}),
          ...(typeof body.travelTrips === 'number' ? { travelTrips: body.travelTrips } : {}),
          ...(typeof body.marketShockBps === 'number' ? { marketShockBps: body.marketShockBps } : {}),
          ...(typeof body.tokenShockBps === 'number' ? { tokenShockBps: body.tokenShockBps } : {}),
        };
      }
    }
    if (!scenario) {
      return this.fail(requestId, 'VALIDATION', 'scenario text or kind is required');
    }
    const simulated = this.service.simulateScenario({
      actor,
      subjectId: principal.identityId,
      scenario,
      ...(constraints ? { constraints } : {}),
      ...(ports ? { ports } : {}),
    });
    if (!simulated.ok) {
      return this.fail(requestId, simulated.error.code, simulated.error.message);
    }
    return {
      schema: 'sunrey.consumer.personal-economy.scenario.v1',
      guaranteedOutcome: false,
      simulationOnly: true,
      disclaimer: SIMULATION_DISCLAIMER,
      outcome: simulated.value,
      resultKind: 'SIMULATION',
    };
  }

  proposals(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    const actor = this.deps.resolveActor(principal);
    const goalSummary = typeof body.goalSummary === 'string' ? body.goalSummary : undefined;
    const constraints = this.deps.constraintsFor?.(principal);
    const ports = this.deps.snapshotPortsFor?.(principal);
    const proposed = this.service.proposeFromPlan({
      actor,
      subjectId: principal.identityId,
      ...(constraints ? { constraints } : {}),
      ...(ports ? { ports } : {}),
      ...(goalSummary ? { goalSummary } : {}),
    });
    if (!proposed.ok) {
      return this.fail(requestId, proposed.error.code, proposed.error.message);
    }
    return {
      schema: 'sunrey.consumer.personal-economy.proposals.v1',
      productionActive: false,
      autoExecution: false,
      guaranteedOutcome: false,
      disclaimer: SIMULATION_DISCLAIMER,
      items: proposed.value,
      resultKind: 'PROPOSAL',
    };
  }

  private fail(requestId: string, code: string, message: string): BffErrorEnvelope {
    const errorCode =
      code === 'ACTOR_CONTEXT_REQUIRED' || code === 'CAPABILITY_DENIED' || code === 'SUBJECT_MISMATCH'
        ? 'RESOURCE_NOT_OWNED'
        : code === 'GRAPH_UNAVAILABLE' || code === 'PLAN_UNAVAILABLE'
          ? 'NOT_FOUND'
          : 'VALIDATION';
    return bffError({
      errorCode,
      category:
        errorCode === 'RESOURCE_NOT_OWNED'
          ? 'AUTHORIZATION'
          : errorCode === 'NOT_FOUND'
            ? 'NOT_FOUND'
            : 'VALIDATION',
      message,
      retryable: false,
      requestId,
      detailsSafeForClient: { code },
    });
  }
}

export function dispatchPersonalEconomy(
  surface: PersonalEconomyBffSurface,
  request: { readonly method: string; readonly path: string; readonly body: unknown },
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): { readonly status: number; readonly body: unknown; readonly headers: Record<string, string> } | null {
  const body =
    request.body && typeof request.body === 'object' && !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  if (request.path === '/api/v1/personal-economy/overview' && request.method === 'GET') {
    const outcome = surface.overview(principal, requestId);
    return wrap(outcome, headers, 200);
  }
  if (request.path === '/api/v1/personal-economy/plan' && request.method === 'GET') {
    const outcome = surface.plan(principal, requestId);
    return wrap(outcome, headers, 200);
  }
  if (request.path === '/api/v1/personal-economy/scenarios' && request.method === 'POST') {
    const outcome = surface.scenarios(principal, body, requestId);
    return wrap(outcome, headers, 200);
  }
  if (request.path === '/api/v1/personal-economy/proposals' && request.method === 'POST') {
    const outcome = surface.proposals(principal, body, requestId);
    return wrap(outcome, headers, 201);
  }
  return null;
}

function wrap(
  body: Record<string, unknown> | BffErrorEnvelope,
  headers: Record<string, string>,
  okStatus: number,
): { readonly status: number; readonly body: unknown; readonly headers: Record<string, string> } {
  if ('errorCode' in body) {
    const status =
      body.errorCode === 'RESOURCE_NOT_OWNED' ? 403 : body.errorCode === 'NOT_FOUND' ? 404 : 400;
    return { status, body, headers };
  }
  return { status: okStatus, body, headers };
}
