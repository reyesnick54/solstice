import type { Clock } from '@solstice/config';
import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { StrategyCapsuleRef } from '../strategy-capsule/types.ts';
import type { OrderPlanningInput, OrderPlanningResult } from '../multi-asset/m22/types.ts';
import type { ExecutionRoutingRequest, ExecutionRoutingResult } from '../execution-routing/types.ts';
import type {
  ExecutionTwinAssumptionCategory,
  ExecutionTwinEnvironmentKind,
  ExecutionTwinEventKind,
  ExecutionTwinOrderState,
  ExecutionTwinProviderKind,
  ExecutionTwinRunState,
} from './taxonomy.ts';

/** Strategy Lab / M09 feature manifest binding for parity across environments. */
export type ExecutionTwinFeatureManifest = {
  readonly manifestId: string;
  readonly version: string;
  readonly contentHash: string;
  readonly strategyLabCompilerVersion: string | null;
};

export type ExecutionTwinAssumption = {
  readonly category: ExecutionTwinAssumptionCategory;
  readonly label: string;
  readonly value: string;
};

export type ExecutionTwinEnvironment = {
  readonly kind: ExecutionTwinEnvironmentKind;
  readonly liveEnabled: false;
  readonly simulationPosture: true;
  readonly assumptions: readonly ExecutionTwinAssumption[];
  readonly providerKind: ExecutionTwinProviderKind;
};

export type ExecutionTwinEvent = {
  readonly sequence: number;
  readonly kind: ExecutionTwinEventKind;
  readonly at: UtcInstant;
  readonly detail: string;
  readonly payloadDigest: string;
};

export type ExecutionTwinOrderTransition = {
  readonly from: ExecutionTwinOrderState;
  readonly to: ExecutionTwinOrderState;
  readonly at: UtcInstant;
  readonly reason: string;
};

export type ExecutionTwinRunManifest = {
  readonly runId: string;
  readonly environment: ExecutionTwinEnvironmentKind;
  readonly providerKind: ExecutionTwinProviderKind;
  readonly strategyCapsule: StrategyCapsuleRef;
  readonly featureManifest: ExecutionTwinFeatureManifest;
  readonly executionConfigDigest: string;
  readonly randomSeed: string;
  readonly assumptions: readonly ExecutionTwinAssumption[];
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly outcomeFingerprint: string | null;
  readonly grantsExecutionAuthority: false;
  readonly liveFlagsActive: false;
};

export type ExecutionTwinOutcome = {
  readonly runId: string;
  readonly state: ExecutionTwinRunState;
  readonly planning: OrderPlanningResult | null;
  readonly routing: ExecutionRoutingResult | null;
  readonly orderState: ExecutionTwinOrderState;
  readonly transitions: readonly ExecutionTwinOrderTransition[];
  readonly events: readonly ExecutionTwinEvent[];
  readonly outcomeFingerprint: string;
  readonly riskDecision: ExecutionTwinGateDecision;
  readonly mandateDecision: ExecutionTwinGateDecision;
  readonly complianceDecision: ExecutionTwinGateDecision;
  readonly authorityDecision: ExecutionTwinGateDecision;
};

export type ExecutionTwinGateDecision = {
  readonly permitted: boolean;
  readonly reason: string;
  readonly digest: string;
};

export type ExecutionTwinRiskPort = {
  evaluate(input: {
    readonly customerId: CustomerId;
    readonly capsuleHash: string;
    readonly featureManifestHash: string;
    readonly executionConfigDigest: string;
    readonly at: UtcInstant;
  }): ExecutionTwinGateDecision;
};

export type ExecutionTwinCompliancePort = {
  evaluate(input: {
    readonly customerId: CustomerId;
    readonly jurisdictionEligible: boolean;
    readonly at: UtcInstant;
  }): ExecutionTwinGateDecision;
};

export type ExecutionTwinAuthorityPort = {
  /** Verifies upstream authority binding; twin never issues authority. */
  verifyBound(input: {
    readonly workOrderId: string;
    readonly at: UtcInstant;
  }): ExecutionTwinGateDecision;
};

export type ExecutionTwinMandatePort = {
  evaluate(input: {
    readonly mandateActive: boolean;
    readonly planningEligible: boolean;
    readonly at: UtcInstant;
  }): ExecutionTwinGateDecision;
};

export type ExecutionTwinIntegrationPorts = {
  readonly risk: ExecutionTwinRiskPort;
  readonly compliance: ExecutionTwinCompliancePort;
  readonly authority: ExecutionTwinAuthorityPort;
  readonly mandate: ExecutionTwinMandatePort;
};

export type ExecutionTwinRunInput = {
  readonly runId: string;
  readonly environment: ExecutionTwinEnvironmentKind;
  readonly customerId: CustomerId;
  readonly workOrderId: string;
  readonly strategyCapsule: StrategyCapsuleRef;
  readonly featureManifest: ExecutionTwinFeatureManifest;
  readonly executionConfigDigest: string;
  readonly randomSeed: string;
  readonly jurisdictionEligible: boolean;
  readonly mandateActive: boolean;
  readonly planningEligible: boolean;
  readonly orderPlanning: OrderPlanningInput;
  readonly routingRequest: ExecutionRoutingRequest;
};

export type ExecutionTwinStoreSnapshot = {
  readonly runId: string;
  readonly state: ExecutionTwinRunState;
  readonly stepIndex: number;
  readonly orderState: ExecutionTwinOrderState;
  readonly events: readonly ExecutionTwinEvent[];
  readonly transitions: readonly ExecutionTwinOrderTransition[];
  readonly manifest: ExecutionTwinRunManifest;
  readonly lastOutcomeFingerprint: string | null;
};

export type ExecutionTwinRuntimeOptions = {
  readonly clock: Clock;
  readonly ports: ExecutionTwinIntegrationPorts;
};
