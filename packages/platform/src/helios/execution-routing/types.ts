import type { CustomerId, Jurisdiction, UtcInstant } from '@solstice/domain';
import type { EconomicWorkOrderId } from '../ids.ts';
import type {
  ExecutionCapabilityLevel,
  ExecutionRoutingOutcome,
  ExecutionRoutingRejectionReason,
  ProviderCapabilityState,
  ProviderCertificationState,
  ProviderEnvironmentState,
  ProviderHealthState,
  RouteImplementationStatus,
  SupportedOrderAction,
  SupportedOrderType,
} from './taxonomy.ts';
import type { ExecutionRoutingDecisionId } from './ids.ts';

export type ProviderCapabilityObject = {
  readonly providerId: string;
  readonly accountId: string;
  readonly supportedAssetClasses: readonly string[];
  readonly supportedInstruments: readonly string[];
  readonly supportedJurisdictions: readonly Jurisdiction[];
  readonly marketDataCapability: ExecutionCapabilityLevel;
  readonly executionCapability: ExecutionCapabilityLevel;
  readonly custodyCapability: ExecutionCapabilityLevel;
  readonly fundingCapability: ExecutionCapabilityLevel;
  readonly withdrawalCapability: ExecutionCapabilityLevel;
  readonly supportedOrderTypes: readonly SupportedOrderType[];
  readonly supportedSessions: readonly string[];
  readonly environment: ProviderEnvironmentState;
  readonly certificationState: ProviderCertificationState;
  readonly healthState: ProviderHealthState;
  readonly venueIds: readonly string[];
  readonly estimatedFeeBps: number;
  readonly estimatedSpreadBps: number;
  readonly liquidityScore: number;
  readonly rateLimitHeadroom: number;
  readonly implementationStatus: RouteImplementationStatus;
  readonly credentialEnvVar: string | null;
  readonly routeId: string;
};

export type AccountRoutingContext = {
  readonly accountId: string;
  readonly customerId: CustomerId;
  readonly legalEntityId: string;
  readonly accountClass: string;
  readonly eligible: boolean;
  readonly certified: boolean;
  readonly funded: boolean;
  readonly fundingState: 'FUNDED' | 'PARTIAL' | 'UNFUNDED';
};

export type ExecutionRoutingRequest = {
  readonly requestId: string;
  readonly customerId: CustomerId;
  readonly legalEntityId: string;
  readonly jurisdiction: Jurisdiction;
  readonly workOrderId: EconomicWorkOrderId;
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly orderType: SupportedOrderType;
  readonly orderAction: SupportedOrderAction;
  readonly notionalMinorUnits: string;
  readonly currency: string;
  readonly venuePreference?: string | null;
  readonly accountContexts: readonly AccountRoutingContext[];
  readonly marketSession: string;
  readonly venueAvailable: boolean;
  readonly at: UtcInstant;
};

export type RejectedRouteAlternative = {
  readonly providerId: string;
  readonly accountId: string;
  readonly venueId: string;
  readonly routeId: string;
  readonly reasons: readonly ExecutionRoutingRejectionReason[];
};

export type ExecutionRoutingEvidence = {
  readonly evidenceRef: string;
  readonly decisionId: ExecutionRoutingDecisionId;
  readonly requestId: string;
  readonly sealedAt: UtcInstant;
  readonly priorEvidenceRef: string | null;
  readonly inputDigest: string;
  readonly outcome: ExecutionRoutingOutcome;
  readonly selectedRouteId: string | null;
  readonly rejectedCount: number;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

export type ExecutionRoutingResult = {
  readonly decisionId: ExecutionRoutingDecisionId;
  readonly outcome: ExecutionRoutingOutcome;
  readonly selectedProviderId: string | null;
  readonly selectedAccountId: string | null;
  readonly selectedVenueId: string | null;
  readonly selectedRouteId: string | null;
  readonly rejectedAlternatives: readonly RejectedRouteAlternative[];
  readonly selectionReason: string;
  readonly executionCapability: ExecutionCapabilityLevel;
  readonly providerEnvironment: ProviderEnvironmentState | null;
  readonly providerCapabilityState: ProviderCapabilityState | null;
  readonly evidence: ExecutionRoutingEvidence;
  readonly validUntil: UtcInstant;
  readonly failoverApplied: boolean;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

export type ExecutionRoutingIntegrationPorts = {
  readonly riskPermits: (input: {
    readonly customerId: CustomerId;
    readonly instrumentId: string;
    readonly assetClass: string;
    readonly providerId: string;
    readonly venueId: string;
    readonly notionalMinorUnits: string;
    readonly orderAction: SupportedOrderAction;
  }) => boolean;
  readonly jurisdictionPermits: (input: {
    readonly legalEntityId: string;
    readonly customerId: CustomerId;
    readonly jurisdiction: Jurisdiction;
    readonly providerId: string;
    readonly instrumentId: string;
    readonly assetClass: string;
    readonly at: UtcInstant;
  }) => boolean;
  readonly mandateActive: (workOrderId: EconomicWorkOrderId, customerId: CustomerId) => boolean;
  readonly customerEligible: (customerId: CustomerId, jurisdiction: Jurisdiction) => boolean;
};

export type ExecutionRoutingProviderRegistryPort = {
  listCapabilities(): readonly ProviderCapabilityObject[];
  getCapability(providerId: string, accountId: string): ProviderCapabilityObject | null;
};

export type ExecutionRoutingStoreSnapshot = {
  readonly decisions: readonly ExecutionRoutingResult[];
  readonly lastEvidenceRef: string | null;
};

export type ExecutionRoutingStorePort = {
  putDecision(decision: ExecutionRoutingResult): void;
  getDecision(decisionId: ExecutionRoutingDecisionId): ExecutionRoutingResult | null;
  getLatestForRequest(requestId: string): ExecutionRoutingResult | null;
  snapshot(): ExecutionRoutingStoreSnapshot;
  restore(snapshot: ExecutionRoutingStoreSnapshot): void;
};

export type ProviderRouteCatalogEntry = {
  readonly routeId: string;
  readonly providerId: string;
  readonly assetClasses: readonly string[];
  readonly implementationStatus: RouteImplementationStatus;
  readonly sandboxQualified: boolean;
  readonly credentialDependent: boolean;
  readonly productionDisabled: true;
  readonly externallyRequired: boolean;
  readonly notes: string;
};
