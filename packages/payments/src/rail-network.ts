import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import { InMemorySecretProvider } from '../../security/src/secrets.ts';
import type { PaymentId } from './ids.ts';
import { RailCapabilityRegistry, simulationCapabilities, type RailCapability } from './rail-capability.ts';
import { SimulatedRailAdapter, type SimulatedAdapterMode } from './rail-adapters.ts';
import { SimulationProviderAuthenticator, simulationAuthConfig, type ProviderAuthConfig } from './rail-auth.ts';
import { healthBlocksRouting, RailCircuitBreaker, type CircuitFailureKind } from './rail-health.ts';
import { RailMetrics } from './rail-metrics.ts';
import type { AuthorizedRailCommand, RailAdapter, RailQueryRequest, RailSubmitResult } from './rail-port.ts';
import { decideRetry } from './rail-retry.ts';
import { RailStore } from './rail-store.ts';
import {
  ProviderCallbackIngestor,
  signSimulationCallback,
  type IncomingProviderCallback,
} from './rail-webhook.ts';
import type { PaymentRoute } from './route.ts';
import { simulationRoutesFor } from './route.ts';
import {
  InProcessSettlementRail,
  type RailMode,
  type SettlementOutcome,
  type SettlementRequest,
  type SimulatedSettlementRail,
} from './settlement.ts';
import { asSettlementRef } from './ids.ts';
import type { ProviderId } from './rail-ids.ts';

const ROUTE_PROVIDER: Readonly<Record<string, string>> = {
  'sim-gcc-usd-sar': 'SIMULATED_PROVIDER_GCC',
  'sim-swift-usd-sar': 'SIMULATED_PROVIDER_CORRESPONDENT',
  'sim-noncompliant-usd-sar': 'SIMULATED_PROVIDER_BLOCKED',
  'sim-gcc-sar-usd': 'SIMULATED_PROVIDER_GCC',
};

/**
 * Simulation rail network: one canonical port, many rail-class adapters.
 * Orchestration stays in PaymentsService. Adapters only talk to the
 * simulated provider.
 */
export class RailNetwork {
  readonly registry: RailCapabilityRegistry;
  readonly store: RailStore;
  readonly metrics: RailMetrics;
  readonly breaker: RailCircuitBreaker;
  readonly callbacks: ProviderCallbackIngestor;
  readonly authenticator: SimulationProviderAuthenticator;
  private readonly adapters = new Map<string, SimulatedRailAdapter>();
  private readonly authConfigs = new Map<string, ProviderAuthConfig>();
  private readonly now: () => UtcInstant;

  constructor(now: () => UtcInstant, capabilities: readonly RailCapability[] = simulationCapabilities()) {
    this.now = now;
    this.registry = new RailCapabilityRegistry(capabilities);
    this.store = new RailStore();
    this.metrics = new RailMetrics();
    this.breaker = new RailCircuitBreaker(now);
    const secrets = new InMemorySecretProvider('simulation');
    this.authenticator = new SimulationProviderAuthenticator(secrets);
    for (const capability of capabilities) {
      const adapter = new SimulatedRailAdapter(capability);
      this.adapters.set(adapterKey(capability.rail, capability.provider), adapter);
      const config = simulationAuthConfig(capability.provider);
      this.authConfigs.set(capability.provider, config);
    }
    this.callbacks = new ProviderCallbackIngestor(this.authenticator, this.authConfigs, now);
  }

  adapter(rail: string, provider: string): RailAdapter | undefined {
    return this.adapters.get(adapterKey(rail, provider));
  }

  adapterForRoute(route: PaymentRoute): SimulatedRailAdapter | undefined {
    const provider = ROUTE_PROVIDER[route.routeId] ?? route.provider;
    return this.adapters.get(adapterKey(route.rail, provider)) ?? this.adapters.get(adapterKey('INTERNATIONAL_CORRESPONDENT', provider));
  }

  setMode(paymentId: string, mode: SimulatedAdapterMode | RailMode): void {
    for (const adapter of this.adapters.values()) {
      adapter.setMode(paymentId, mode as SimulatedAdapterMode);
    }
  }

  setProviderHealth(provider: string, health: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'MAINTENANCE'): void {
    this.breaker.setHealth(provider as ProviderId, health);
    this.registry.withHealth(provider, health);
    this.store.saveHealth(this.breaker.snapshot(provider as ProviderId));
    this.metrics.recordAvailability(health === 'AVAILABLE' || health === 'DEGRADED');
  }

  recordFailure(provider: string, kind: CircuitFailureKind): void {
    const record = this.breaker.recordFailure(provider as ProviderId, kind);
    this.registry.withHealth(provider, record.health);
    this.store.saveHealth(record);
  }

  routesFor(corridorId: string, fee: Money): readonly PaymentRoute[] {
    return simulationRoutesFor(corridorId, fee).map((route) => {
      const provider = ROUTE_PROVIDER[route.routeId] ?? route.provider;
      const health = this.breaker.snapshot(provider as ProviderId).health;
      const capability = this.registry.findFor(route.rail as never, provider);
      const available =
        route.available &&
        !healthBlocksRouting(health) &&
        (capability ? capability.available && capability.enabled : route.compliant);
      return Object.freeze({ ...route, provider, available });
    });
  }

  toSettlementOutcome(result: RailSubmitResult, request: SettlementRequest): SettlementOutcome {
    return submitResultToOutcome(result, request);
  }

  submit(command: AuthorizedRailCommand): RailSubmitResult {
    const existing = this.store.getByIdempotency(command.submission.idempotencyKey);
    if (existing?.executionUnknown) {
      const decision = decideRetry('SUBMIT', existing.status, { executionUnknown: true });
      if (!decision.allowed) {
        return {
          status: 'SUBMISSION_UNKNOWN',
          retryClass: decision.retryClass,
          rejectionClass: null,
          references: existing.references,
          providerStatus: 'LOCAL_UNKNOWN',
          message: decision.reason,
        };
      }
    }
    const adapter =
      this.adapters.get(adapterKey(command.submission.rail, command.submission.provider)) ??
      [...this.adapters.values()][0];
    if (!adapter) {
      return {
        status: 'REJECTED',
        retryClass: 'PERMANENT_FAILURE',
        rejectionClass: 'PRE_SUBMISSION_REJECTION',
        references: command.submission.references,
        providerStatus: 'NO_ADAPTER',
        message: 'no simulated adapter registered',
      };
    }
    this.metrics.recordSubmission();
    const result = adapter.submitPayment(command);
    if (result.status === 'ACCEPTED' || result.status === 'PENDING' || result.status === 'PROCESSING' || result.status === 'SETTLED') {
      this.metrics.recordAccepted();
    }
    if (result.status === 'REJECTED') {
      this.metrics.recordRejected();
    }
    if (result.status === 'SUBMISSION_UNKNOWN') {
      this.metrics.recordUnknown();
    }
    if (result.status === 'SETTLED') {
      this.metrics.recordSettled(0n);
    }
    return result;
  }

  query(request: RailQueryRequest): ReturnType<RailAdapter['queryPayment']> {
    for (const adapter of this.adapters.values()) {
      const result = adapter.queryPayment(request);
      if (result.found) {
        return result;
      }
    }
    return {
      found: false,
      status: 'UNKNOWN',
      references: commandEmptyRefs(),
      providerStatus: 'NOT_FOUND',
    };
  }

  complete(paymentId: PaymentId): SettlementOutcome {
    for (const adapter of this.adapters.values()) {
      const result = adapter.complete(paymentId, this.now());
      if (result && result.status === 'SETTLED') {
        return {
          kind: 'SUCCESS',
          settlementRef: asSettlementRef(result.references.settlementReference ?? `sim_${paymentId}`),
          providerAmountMinorUnits: '0',
          providerCurrency: 'USD',
        };
      }
    }
    return { kind: 'FAIL_BEFORE_SUBMIT', reason: 'no pending simulated submission' };
  }

  signCallback(callback: Omit<IncomingProviderCallback, 'signature'>): IncomingProviderCallback {
    const config = this.authConfigs.get(callback.provider);
    if (!config) {
      throw new Error('unknown provider for callback signing');
    }
    return signSimulationCallback(this.authenticator, config, callback);
  }

  asSettlementRail(): SimulatedSettlementRail & Partial<InProcessSettlementRail> {
    const network = this;
    return {
      setMode(paymentId: string, mode: SimulatedAdapterMode | RailMode): void {
        network.setMode(paymentId, mode);
      },
      submit(request: SettlementRequest): SettlementOutcome {
        const adapter = [...network.adapters.values()].find((row) => row.capability.provider === 'SIMULATED_PROVIDER_GCC')
          ?? [...network.adapters.values()][0];
        if (!adapter) {
          return { kind: 'FAIL_BEFORE_SUBMIT', reason: 'no adapter' };
        }
        const command: AuthorizedRailCommand = {
          authorityId: 'legacy',
          actionType: 'INITIATE_PAYMENT',
          submission: {
            railSubmissionId: `rsub_${request.paymentId}` as never,
            paymentId: request.paymentId,
            provider: adapter.capability.provider,
            rail: adapter.capability.rail,
            amount: { minorUnits: BigInt(request.destinationAmountMinorUnits), currency: request.destinationCurrency } as Money,
            currency: request.destinationCurrency as never,
            sourceReference: 'src_opaque' as never,
            destinationReference: 'dst_opaque' as never,
            beneficiaryReference: 'ben_opaque' as never,
            purposeReference: 'legacy',
            idempotencyKey: request.idempotencyKey as never,
            correlationId: request.idempotencyKey,
            submittedAt: network.now(),
            requestedSettlement: { settlementClass: 'CORRESPONDENT', requestedAt: null },
            status: 'PENDING',
            executionUnknown: false,
            references: commandEmptyRefs(),
            rejectionClass: null,
          },
        };
        const result = adapter.submitPayment(command);
        return submitResultToOutcome(result, request);
      },
      complete(paymentId: PaymentId): SettlementOutcome {
        return network.complete(paymentId);
      },
    };
  }
}

export function createSimulationRailNetwork(now: () => UtcInstant): RailNetwork {
  return new RailNetwork(now);
}

function adapterKey(rail: string, provider: string): string {
  return `${rail}::${provider}`;
}

function commandEmptyRefs() {
  return {
    providerPaymentId: null,
    railReference: null,
    settlementReference: null,
    returnReference: null,
    traceReference: null,
  };
}

function submitResultToOutcome(result: RailSubmitResult, request: SettlementRequest): SettlementOutcome {
  if (result.rejectionClass === 'PRE_SUBMISSION_REJECTION') {
    return { kind: 'FAIL_BEFORE_SUBMIT', reason: result.message };
  }
  if (result.status === 'SUBMISSION_UNKNOWN') {
    return {
      kind: 'SUBMISSION_UNKNOWN',
      reason: result.message,
      settlementRef: asSettlementRef(result.references.settlementReference ?? `unknown_${request.idempotencyKey}`),
    };
  }
  if (result.status === 'REJECTED') {
    return {
      kind: 'FAIL_AFTER_SUBMIT',
      reason: result.message,
      settlementRef: asSettlementRef(result.references.settlementReference ?? `sim_${request.idempotencyKey}`),
    };
  }
  if (result.status === 'PENDING' || result.status === 'PROCESSING' || result.status === 'ACCEPTED') {
    return {
      kind: 'PENDING',
      settlementRef: asSettlementRef(result.references.settlementReference ?? `sim_${request.idempotencyKey}`),
    };
  }
  if (result.status === 'RETURNED') {
    return {
      kind: 'RETURNED',
      settlementRef: asSettlementRef(result.references.settlementReference ?? `sim_${request.idempotencyKey}`),
      providerAmountMinorUnits: request.destinationAmountMinorUnits,
      providerCurrency: request.destinationCurrency,
    };
  }
  return {
    kind: 'SUCCESS',
    settlementRef: asSettlementRef(result.references.settlementReference ?? `sim_${request.idempotencyKey}`),
    providerAmountMinorUnits: request.destinationAmountMinorUnits,
    providerCurrency: request.destinationCurrency,
  };
}
