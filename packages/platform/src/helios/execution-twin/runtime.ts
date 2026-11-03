import { createHash } from 'node:crypto';

import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import { asHeliosOperationId, asHeliosOrderId } from '../order-lifecycle/ids.ts';
import { planExecutionTactic } from '../multi-asset/m22/planner.ts';
import {
  ExecutionRoutingService,
  createDefaultProviderCapabilityRegistry,
} from '../execution-routing/index.ts';
import type { ExecutionRoutingIntegrationPorts, ExecutionRoutingRequest } from '../execution-routing/types.ts';
import { buildExecutionTwinRunManifest } from './manifest.ts';
import { ExecutionTwinClock } from './clock.ts';
import { buildExecutionTwinOutcome, digestPayload } from './outcome.ts';
import {
  assertEnvironmentProviderParity,
  createExecutionTwinProvider,
  externalOperationIdForStep,
} from './providers.ts';
import { InMemoryExecutionTwinStore } from './store.ts';
import { environmentPermitsProviderSubmit } from './taxonomy.ts';
import type {
  ExecutionTwinEvent,
  ExecutionTwinGateDecision,
  ExecutionTwinIntegrationPorts,
  ExecutionTwinOrderTransition,
  ExecutionTwinRunInput,
  ExecutionTwinRuntimeOptions,
  ExecutionTwinStoreSnapshot,
} from './types.ts';
import type { ExecutionTwinOrderState, ExecutionTwinRunState } from './taxonomy.ts';

function gateDecision(permitted: boolean, reason: string, material: unknown): ExecutionTwinGateDecision {
  const digest = createHash('sha256').update(JSON.stringify(material)).digest('hex').slice(0, 32);
  return Object.freeze({ permitted, reason, digest });
}

export class ExecutionTwinRuntime {
  private readonly clock: ExecutionTwinClock;
  private readonly ports: ExecutionTwinIntegrationPorts;
  private readonly store: InMemoryExecutionTwinStore;
  private readonly routingPorts: ExecutionRoutingIntegrationPorts;

  constructor(options: ExecutionTwinRuntimeOptions & {
    readonly store?: InMemoryExecutionTwinStore;
    readonly routingPorts?: ExecutionRoutingIntegrationPorts;
    readonly startAt: UtcInstant;
  }) {
    this.clock = new ExecutionTwinClock(options.startAt);
    this.ports = options.ports;
    this.store = options.store ?? new InMemoryExecutionTwinStore();
    this.routingPorts =
      options.routingPorts ??
      Object.freeze({
        riskPermits: () => true,
        jurisdictionPermits: () => true,
        mandateActive: () => true,
        customerEligible: () => true,
      });
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  storeSnapshot(): InMemoryExecutionTwinStore {
    return this.store;
  }

  run(input: ExecutionTwinRunInput): ExecutionTwinStoreSnapshot {
    this.assertLiveDisabled();
    if (input.environment === 'LIVE') {
      throw new Error('LIVE execution twin environment is disabled');
    }

    const events: ExecutionTwinEvent[] = [];
    let sequence = 0;
    const pushEvent = (kind: ExecutionTwinEvent['kind'], detail: string, payload: unknown) => {
      sequence += 1;
      events.push(
        Object.freeze({
          sequence,
          kind,
          at: this.clock.now(),
          detail,
          payloadDigest: digestPayload(payload),
        }),
      );
    };

    const manifest = buildExecutionTwinRunManifest({
      runId: input.runId,
      environment: input.environment,
      strategyCapsule: input.strategyCapsule,
      featureManifest: input.featureManifest,
      executionConfigDigest: input.executionConfigDigest,
      randomSeed: input.randomSeed,
      startedAt: this.clock.now(),
    });

    pushEvent('RUN_STARTED', `environment=${input.environment}`, manifest);

    const mandateDecision = this.ports.mandate.evaluate({
      mandateActive: input.mandateActive,
      planningEligible: input.planningEligible,
      at: this.clock.now(),
    });
    pushEvent('MANDATE_CHECK', mandateDecision.reason, mandateDecision);

    const complianceDecision = this.ports.compliance.evaluate({
      customerId: input.customerId,
      jurisdictionEligible: input.jurisdictionEligible,
      at: this.clock.now(),
    });
    pushEvent('COMPLIANCE_CHECK', complianceDecision.reason, complianceDecision);

    const authorityDecision = this.ports.authority.verifyBound({
      workOrderId: input.workOrderId,
      at: this.clock.now(),
    });
    pushEvent('EXECUTION_AUTHORITY_CHECK', authorityDecision.reason, authorityDecision);

    const riskDecision = this.ports.risk.evaluate({
      customerId: input.customerId,
      capsuleHash: input.strategyCapsule.contentHash,
      featureManifestHash: input.featureManifest.contentHash,
      executionConfigDigest: input.executionConfigDigest,
      at: this.clock.now(),
    });
    pushEvent('RISK_CHECK', riskDecision.reason, riskDecision);

    pushEvent('FEATURE_SNAPSHOT', input.featureManifest.manifestId, input.featureManifest);

    let orderState: ExecutionTwinOrderState = 'NONE';
    const transitions: ExecutionTwinOrderTransition[] = [];

    const recordTransition = (to: ExecutionTwinOrderState, reason: string) => {
      const from = orderState;
      orderState = to;
      transitions.push(
        Object.freeze({
          from,
          to,
          at: this.clock.now(),
          reason,
        }),
      );
      pushEvent('ORDER_STATE_TRANSITION', `${from}->${to}`, { from, to, reason });
    };

    let state: ExecutionTwinRunState = 'RUNNING';
    let planning = null as ReturnType<typeof planExecutionTactic> | null;
    let routing = null as ReturnType<ExecutionRoutingService['resolveRoute']> | null;

    const gatesOk =
      mandateDecision.permitted &&
      complianceDecision.permitted &&
      authorityDecision.permitted &&
      riskDecision.permitted;

    if (!gatesOk) {
      state = 'FAILED';
      pushEvent('RUN_FAILED', 'gate_refusal', {
        mandate: mandateDecision.permitted,
        compliance: complianceDecision.permitted,
        authority: authorityDecision.permitted,
        risk: riskDecision.permitted,
      });
    } else {
      planning = planExecutionTactic(input.orderPlanning);
      pushEvent('TACTIC_PLANNED', planning.outcome, planning);
      if (planning.outcome !== 'PLANNED' || !planning.tactic) {
        state = 'FAILED';
        pushEvent('RUN_FAILED', 'tactic_planning_refused', planning);
      } else {
        recordTransition('PLANNED', 'm22_tactic_planned');

        const routingService = new ExecutionRoutingService({
          registry: createDefaultProviderCapabilityRegistry(),
          ports: this.routingPorts,
        });
        routing = routingService.resolveRoute(input.routingRequest);
        pushEvent('ROUTE_SELECTED', routing.outcome, routing);
        if (routing.outcome !== 'ROUTE_SELECTED') {
          state = 'FAILED';
          pushEvent('RUN_FAILED', 'routing_refused', routing);
        } else {
          recordTransition('ROUTED', 'm23_route_selected');

          const provider = createExecutionTwinProvider({
            environment: input.environment,
            randomSeed: input.randomSeed,
            now: this.clock.now(),
          });
          assertEnvironmentProviderParity(input.environment, provider);

          if (environmentPermitsProviderSubmit(input.environment) && provider.heliosProviderPort && planning.tactic) {
            const externalOperationId = externalOperationIdForStep(input.randomSeed, 'submit_primary');
            const operationId = asHeliosOperationId(`op_twin_${planning.tactic.tacticId}`);
            const orderId = asHeliosOrderId(`ord_twin_${planning.tactic.tacticId}`);
            const providerOrderType =
              planning.tactic.orderType === 'MARKET' ? ('MARKET' as const) : ('LIMIT' as const);
            const submitResult = provider.heliosProviderPort.submit({
              externalOperationId,
              operationId,
              orderId,
              instrumentId: input.orderPlanning.executionPlan.instrumentId,
              side: planning.tactic.side,
              quantityUnits: planning.tactic.quantityUnits.toString(),
              orderType: providerOrderType,
              limitPriceMinorUnits: planning.tactic.limitPriceMinor?.toString() ?? null,
              currency: input.orderPlanning.executionPlan.currency,
              timeInForce: planning.tactic.timeInForce,
            });
            pushEvent('ORDER_SUBMITTED', submitResult.outcome, submitResult);
            recordTransition('SUBMITTED', 'provider_submit');
            if (submitResult.outcome === 'ACKNOWLEDGED') {
              recordTransition('ACKNOWLEDGED', 'provider_ack');
              recordTransition('FILLED', 'deterministic_fill_completion');
            } else if (submitResult.outcome === 'REJECTED') {
              recordTransition('REJECTED', 'provider_reject');
            }
          } else if (input.environment === 'SHADOW') {
            pushEvent('ORDER_SUBMITTED', 'SHADOW_ONLY', { shadow: true });
          }

          pushEvent('SETTLEMENT_RECORDED', 'm24_semantics_simulated', {
            settlement: input.environment === 'SANDBOX_LIVE_DATA' ? 'T+1_simulated' : 'not_applicable',
          });
          pushEvent('RECONCILIATION_RECORDED', 'm24_reconciliation_simulated', { runId: input.runId });
          state = 'COMPLETED';
        }
      }
    }

    const outcome = buildExecutionTwinOutcome({
      runId: input.runId,
      state,
      planning,
      routing,
      orderState,
      transitions,
      events,
      riskDecision,
      mandateDecision,
      complianceDecision,
      authorityDecision,
    });

    pushEvent('RUN_COMPLETED', state, { outcomeFingerprint: outcome.outcomeFingerprint });
    this.clock.advanceByMs(1);

    const completedManifest = buildExecutionTwinRunManifest({
      ...manifest,
      completedAt: this.clock.now(),
      outcomeFingerprint: outcome.outcomeFingerprint,
    });

    const snapshot: ExecutionTwinStoreSnapshot = Object.freeze({
      runId: input.runId,
      state,
      stepIndex: sequence,
      orderState,
      events: Object.freeze(events),
      transitions: Object.freeze(transitions),
      manifest: completedManifest,
      lastOutcomeFingerprint: outcome.outcomeFingerprint,
    });

    this.store.save(snapshot);
    return snapshot;
  }

  resume(runId: string, input: ExecutionTwinRunInput): ExecutionTwinStoreSnapshot {
    const existing = this.store.load(runId);
    if (!existing) {
      return this.run(input);
    }
    if (existing.state === 'COMPLETED' || existing.state === 'FAILED') {
      return existing;
    }
    return this.run({ ...input, runId });
  }

  private assertLiveDisabled(): void {
    if (LIVE_TRADING_ENABLED || LIVE_INVESTMENT_EXECUTION) {
      throw new Error('LIVE flags must remain disabled for execution twin runs');
    }
  }
}
