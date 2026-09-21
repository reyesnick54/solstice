export {
  EXECUTION_ROUTING_OUTCOMES,
  EXECUTION_ROUTING_REJECTION_REASONS,
  PROVIDER_CAPABILITY_STATES,
  PROVIDER_ENVIRONMENT_STATES,
  PROVIDER_CERTIFICATION_STATES,
  PROVIDER_HEALTH_STATES,
  EXECUTION_CAPABILITY_LEVELS,
  ROUTE_IMPLEMENTATION_STATUSES,
  SUPPORTED_ORDER_TYPES,
  SUPPORTED_ORDER_ACTIONS,
  type ExecutionRoutingOutcome,
  type ExecutionRoutingRejectionReason,
  type ProviderCapabilityState,
  type ProviderEnvironmentState,
  type ProviderCertificationState,
  type ProviderHealthState,
  type ExecutionCapabilityLevel,
  type RouteImplementationStatus,
  type SupportedOrderType,
  type SupportedOrderAction,
} from './taxonomy.ts';

export type {
  ProviderCapabilityObject,
  AccountRoutingContext,
  ExecutionRoutingRequest,
  RejectedRouteAlternative,
  ExecutionRoutingEvidence,
  ExecutionRoutingResult,
  ExecutionRoutingIntegrationPorts,
  ExecutionRoutingProviderRegistryPort,
  ExecutionRoutingStoreSnapshot,
  ExecutionRoutingStorePort,
  ProviderRouteCatalogEntry,
} from './types.ts';

export {
  asExecutionRoutingDecisionId,
  executionRoutingDecisionIdFor,
  executionRoutingEvidenceRef,
  type ExecutionRoutingDecisionId,
} from './ids.ts';

export {
  DEFAULT_EXECUTION_PROVIDER_CAPABILITIES,
  createDefaultProviderCapabilityRegistry,
} from './fixtures.ts';

export { EXECUTION_PROVIDER_ROUTE_CATALOG } from './route-catalog.ts';

export { InMemoryExecutionRoutingStore } from './store.ts';
export { ExecutionRoutingService } from './resolver.ts';

export {
  HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED,
  HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_BLOCKED,
  evaluateM23ExecutionRoutingQualification,
  type M23QualificationChecks,
} from './qualification.ts';

export type { ExecutionRoutingProviderAdapterPort } from './adapters/port.ts';
export { createSandboxPaperEquityAdapter } from './adapters/sandbox-paper-equity.ts';
export { createSandboxCryptoExecutionAdapter } from './adapters/sandbox-crypto.ts';
export { createExternalFuturesAdapter } from './adapters/external-futures.ts';
