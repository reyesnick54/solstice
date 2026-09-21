import { createHash } from 'node:crypto';

import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../../../../config/src/flags.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import {
  executionRoutingDecisionIdFor,
  executionRoutingEvidenceRef,
} from './ids.ts';
import type {
  AccountRoutingContext,
  ExecutionRoutingEvidence,
  ExecutionRoutingIntegrationPorts,
  ExecutionRoutingProviderRegistryPort,
  ExecutionRoutingRequest,
  ExecutionRoutingResult,
  ExecutionRoutingStorePort,
  ProviderCapabilityObject,
  RejectedRouteAlternative,
} from './types.ts';
import { InMemoryExecutionRoutingStore } from './store.ts';
import type {
  ExecutionCapabilityLevel,
  ExecutionRoutingRejectionReason,
  ProviderCapabilityState,
  ProviderEnvironmentState,
} from './taxonomy.ts';

const ROUTE_VALIDITY_SECONDS = 300;

function inputDigest(request: ExecutionRoutingRequest): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        requestId: request.requestId,
        customerId: request.customerId,
        instrumentId: request.instrumentId,
        assetClass: request.assetClass,
        orderType: request.orderType,
        orderAction: request.orderAction,
        notionalMinorUnits: request.notionalMinorUnits,
        jurisdiction: request.jurisdiction,
      }),
    )
    .digest('hex');
}

function addReasons(
  map: Map<string, ExecutionRoutingRejectionReason[]>,
  key: string,
  reasons: readonly ExecutionRoutingRejectionReason[],
): void {
  const existing = map.get(key) ?? [];
  map.set(key, [...existing, ...reasons]);
}

function candidateKey(providerId: string, accountId: string, venueId: string): string {
  return `${providerId}|${accountId}|${venueId}`;
}

function mapHealthToCapabilityState(health: ProviderCapabilityObject['healthState']): ProviderCapabilityState {
  switch (health) {
    case 'HEALTHY':
      return 'SANDBOX_AVAILABLE';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'UNAVAILABLE':
      return 'UNAVAILABLE';
    default:
      return 'UNAVAILABLE';
  }
}

function executionCapabilityPermits(level: ExecutionCapabilityLevel): boolean {
  return level === 'FULL' || level === 'LIMITED';
}

function scoreCandidate(cap: ProviderCapabilityObject): number {
  return (
    cap.liquidityScore * 1000 -
    cap.estimatedFeeBps * 10 -
    cap.estimatedSpreadBps -
    (cap.healthState === 'DEGRADED' ? 50_000 : 0) -
    (cap.healthState === 'RATE_LIMITED' ? 25_000 : 0)
  );
}

function selectVenue(cap: ProviderCapabilityObject, preference: string | null | undefined): string | null {
  if (preference && cap.venueIds.includes(preference)) {
    return preference;
  }
  return cap.venueIds[0] ?? null;
}

function findAccountContext(
  contexts: readonly AccountRoutingContext[],
  accountId: string,
  customerId: ExecutionRoutingRequest['customerId'],
): AccountRoutingContext | null {
  return (
    contexts.find((row) => row.accountId === accountId && row.customerId === customerId) ?? null
  );
}

function evaluateCandidate(input: {
  readonly cap: ProviderCapabilityObject;
  readonly request: ExecutionRoutingRequest;
  readonly venueId: string;
  readonly ports: ExecutionRoutingIntegrationPorts;
  readonly allowDegraded: boolean;
}): readonly ExecutionRoutingRejectionReason[] {
  const { cap, request, venueId, ports, allowDegraded } = input;
  const reasons: ExecutionRoutingRejectionReason[] = [];
  const account = findAccountContext(request.accountContexts, cap.accountId, request.customerId);

  if (LIVE_INVESTMENT_EXECUTION || LIVE_TRADING_ENABLED) {
    reasons.push('PROVIDER_PRODUCTION_DISABLED');
  }
  if (cap.implementationStatus === 'EXTERNALLY_REQUIRED') {
    reasons.push('EXTERNAL_PROVIDER_REQUIRED');
  }
  if (cap.environment === 'production_disabled') {
    reasons.push('PROVIDER_PRODUCTION_DISABLED');
  }
  if (!cap.supportedAssetClasses.includes(request.assetClass)) {
    reasons.push('UNSUPPORTED_ASSET_CLASS');
  }
  if (!cap.supportedInstruments.includes(request.instrumentId)) {
    reasons.push('UNSUPPORTED_INSTRUMENT');
  }
  if (!cap.supportedJurisdictions.includes(request.jurisdiction)) {
    reasons.push('UNSUPPORTED_JURISDICTION');
  }
  if (!cap.supportedOrderTypes.includes(request.orderType)) {
    reasons.push('UNSUPPORTED_ORDER_TYPE');
  }
  if (!cap.supportedSessions.includes(request.marketSession)) {
    reasons.push('UNSUPPORTED_SESSION');
  }
  if (!executionCapabilityPermits(cap.executionCapability)) {
    reasons.push('EXECUTION_CAPABILITY_UNAVAILABLE');
  }
  if (cap.custodyCapability === 'UNAVAILABLE' && request.assetClass === 'crypto') {
    reasons.push('CUSTODY_CAPABILITY_UNAVAILABLE');
  }
  if (cap.healthState === 'UNAVAILABLE') {
    reasons.push('PROVIDER_UNAVAILABLE');
  }
  if (cap.healthState === 'DEGRADED' && !allowDegraded) {
    reasons.push('PROVIDER_DEGRADED');
  }
  if (cap.healthState === 'RATE_LIMITED') {
    reasons.push('RATE_LIMITED');
  }
  if (cap.rateLimitHeadroom <= 0) {
    reasons.push('RATE_LIMITED');
  }
  if (cap.certificationState === 'NOT_CERTIFIED') {
    reasons.push('PROVIDER_NOT_CERTIFIED');
  }
  if (cap.liquidityScore <= 0 && request.assetClass !== 'future') {
    reasons.push('INSUFFICIENT_LIQUIDITY');
  }
  if (!request.venueAvailable || !cap.venueIds.includes(venueId)) {
    reasons.push('VENUE_UNAVAILABLE');
  }
  if (request.marketSession === 'CLOSED' || request.marketSession === 'HALTED') {
    reasons.push('MARKET_SESSION_CLOSED');
  }
  if (!ports.customerEligible(request.customerId, request.jurisdiction)) {
    reasons.push('CUSTOMER_NOT_ELIGIBLE');
  }
  if (!ports.mandateActive(request.workOrderId, request.customerId)) {
    reasons.push('MANDATE_INACTIVE');
  }
  if (!account) {
    reasons.push('ACCOUNT_NOT_ELIGIBLE');
  } else {
    if (!account.eligible) {
      reasons.push('ACCOUNT_NOT_ELIGIBLE');
    }
    if (!account.certified) {
      reasons.push('ACCOUNT_NOT_CERTIFIED');
    }
    if (!account.funded || account.fundingState === 'UNFUNDED') {
      reasons.push('ACCOUNT_NOT_FUNDED');
    }
  }
  if (
    !ports.jurisdictionPermits({
      legalEntityId: request.legalEntityId,
      customerId: request.customerId,
      jurisdiction: request.jurisdiction,
      providerId: cap.providerId,
      instrumentId: request.instrumentId,
      assetClass: request.assetClass,
      at: request.at,
    })
  ) {
    reasons.push('JURISDICTION_DENIED');
  }
  if (
    !ports.riskPermits({
      customerId: request.customerId,
      instrumentId: request.instrumentId,
      assetClass: request.assetClass,
      providerId: cap.providerId,
      venueId,
      notionalMinorUnits: request.notionalMinorUnits,
      orderAction: request.orderAction,
    })
  ) {
    reasons.push('RISK_ENGINE_REFUSED');
  }

  return Object.freeze(reasons);
}

function buildUnavailableResult(input: {
  readonly request: ExecutionRoutingRequest;
  readonly rejected: readonly RejectedRouteAlternative[];
  readonly priorEvidenceRef: string | null;
  readonly selectionReason: string;
}): ExecutionRoutingResult {
  const decisionId = executionRoutingDecisionIdFor(input.request.requestId, input.request.at);
  const evidence: ExecutionRoutingEvidence = Object.freeze({
    evidenceRef: executionRoutingEvidenceRef(decisionId),
    decisionId,
    requestId: input.request.requestId,
    sealedAt: input.request.at,
    priorEvidenceRef: input.priorEvidenceRef,
    inputDigest: inputDigest(input.request),
    outcome: 'EXECUTION_ROUTE_UNAVAILABLE',
    selectedRouteId: null,
    rejectedCount: input.rejected.length,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
  });
  const validUntil = new Date(Date.parse(input.request.at) + ROUTE_VALIDITY_SECONDS * 1000).toISOString();
  return Object.freeze({
    decisionId,
    outcome: 'EXECUTION_ROUTE_UNAVAILABLE',
    selectedProviderId: null,
    selectedAccountId: null,
    selectedVenueId: null,
    selectedRouteId: null,
    rejectedAlternatives: input.rejected,
    selectionReason: input.selectionReason,
    executionCapability: 'UNAVAILABLE',
    providerEnvironment: null,
    providerCapabilityState: null,
    evidence,
    validUntil: validUntil as UtcInstant,
    failoverApplied: false,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
  });
}

/**
 * Canonical multi-provider / multi-venue execution routing resolver.
 * Selects which authorized provider/account/venue can service a qualified plan.
 * Does not issue Execution Authority.
 */
export class ExecutionRoutingService {
  private readonly registry: ExecutionRoutingProviderRegistryPort;
  private readonly ports: ExecutionRoutingIntegrationPorts;
  readonly store: ExecutionRoutingStorePort;

  constructor(input: {
    readonly registry: ExecutionRoutingProviderRegistryPort;
    readonly ports: ExecutionRoutingIntegrationPorts;
    readonly store?: ExecutionRoutingStorePort;
  }) {
    this.registry = input.registry;
    this.ports = input.ports;
    this.store = input.store ?? new InMemoryExecutionRoutingStore();
  }

  resolveRoute(request: ExecutionRoutingRequest): ExecutionRoutingResult {
    const prior = this.store.getLatestForRequest(request.requestId);
    const priorEvidenceRef = prior?.evidence.evidenceRef ?? null;
    const rejectionMap = new Map<string, ExecutionRoutingRejectionReason[]>();
    const eligible: Array<{ cap: ProviderCapabilityObject; venueId: string; score: number }> = [];

    for (const cap of this.registry.listCapabilities()) {
      const venueId = selectVenue(cap, request.venuePreference);
      if (!venueId) {
        addReasons(rejectionMap, candidateKey(cap.providerId, cap.accountId, 'NONE'), ['VENUE_UNAVAILABLE']);
        continue;
      }
      const reasons = evaluateCandidate({
        cap,
        request,
        venueId,
        ports: this.ports,
        allowDegraded: false,
      });
      if (reasons.length > 0) {
        addReasons(rejectionMap, candidateKey(cap.providerId, cap.accountId, venueId), reasons);
        continue;
      }
      eligible.push(Object.freeze({ cap, venueId, score: scoreCandidate(cap) }));
    }

    let failoverApplied = false;
    if (eligible.length === 0) {
      for (const cap of this.registry.listCapabilities()) {
        const venueId = selectVenue(cap, request.venuePreference);
        if (!venueId) continue;
        const reasons = evaluateCandidate({
          cap,
          request,
          venueId,
          ports: this.ports,
          allowDegraded: true,
        });
        if (reasons.length === 0 && cap.healthState === 'DEGRADED') {
          eligible.push(
            Object.freeze({ cap, venueId, score: scoreCandidate(cap) - 100_000 }),
          );
          failoverApplied = true;
        }
      }
    }

    eligible.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const providerCmp = a.cap.providerId.localeCompare(b.cap.providerId);
      if (providerCmp !== 0) return providerCmp;
      const accountCmp = a.cap.accountId.localeCompare(b.cap.accountId);
      if (accountCmp !== 0) return accountCmp;
      return a.venueId.localeCompare(b.venueId);
    });

    const rejected: RejectedRouteAlternative[] = [];
    for (const [key, reasons] of rejectionMap.entries()) {
      const [providerId, accountId, venueId] = key.split('|');
      const cap = this.registry.getCapability(providerId!, accountId!);
      rejected.push(
        Object.freeze({
          providerId: providerId!,
          accountId: accountId!,
          venueId: venueId!,
          routeId: cap?.routeId ?? 'unknown',
          reasons: Object.freeze([...new Set(reasons)]),
        }),
      );
    }

    if (eligible.length === 0) {
      const result = buildUnavailableResult({
        request,
        rejected: Object.freeze(rejected),
        priorEvidenceRef,
        selectionReason: 'EXECUTION_ROUTE_UNAVAILABLE: no eligible provider/account/venue',
      });
      this.store.putDecision(result);
      return result;
    }

    const selected = eligible[0]!;
    for (const alt of eligible.slice(1)) {
      rejected.push(
        Object.freeze({
          providerId: alt.cap.providerId,
          accountId: alt.cap.accountId,
          venueId: alt.venueId,
          routeId: alt.cap.routeId,
          reasons: Object.freeze([
            failoverApplied && alt.cap.healthState === 'DEGRADED'
              ? 'FAILOVER_SECONDARY'
              : 'LOWER_PRIORITY_CANDIDATE',
          ]),
        }),
      );
    }

    const decisionId = executionRoutingDecisionIdFor(request.requestId, request.at);
    const evidence: ExecutionRoutingEvidence = Object.freeze({
      evidenceRef: executionRoutingEvidenceRef(decisionId),
      decisionId,
      requestId: request.requestId,
      sealedAt: request.at,
      priorEvidenceRef,
      inputDigest: inputDigest(request),
      outcome: 'ROUTE_SELECTED',
      selectedRouteId: selected.cap.routeId,
      rejectedCount: rejected.length,
      grantsExecutionAuthority: false,
      authorizesFinancialExecution: false,
    });
    const validUntil = new Date(Date.parse(request.at) + ROUTE_VALIDITY_SECONDS * 1000).toISOString();
    const selectionReason = failoverApplied
      ? `Selected ${selected.cap.providerId}/${selected.cap.accountId}@${selected.venueId} via degraded-provider failover (score=${selected.score})`
      : `Selected ${selected.cap.providerId}/${selected.cap.accountId}@${selected.venueId} as highest-scoring eligible route (score=${selected.score})`;

    const result: ExecutionRoutingResult = Object.freeze({
      decisionId,
      outcome: 'ROUTE_SELECTED',
      selectedProviderId: selected.cap.providerId,
      selectedAccountId: selected.cap.accountId,
      selectedVenueId: selected.venueId,
      selectedRouteId: selected.cap.routeId,
      rejectedAlternatives: Object.freeze(rejected),
      selectionReason,
      executionCapability: selected.cap.executionCapability,
      providerEnvironment: selected.cap.environment as ProviderEnvironmentState,
      providerCapabilityState: mapHealthToCapabilityState(selected.cap.healthState),
      evidence,
      validUntil: validUntil as UtcInstant,
      failoverApplied,
      grantsExecutionAuthority: false,
      authorizesFinancialExecution: false,
    });
    this.store.putDecision(result);
    return result;
  }
}
