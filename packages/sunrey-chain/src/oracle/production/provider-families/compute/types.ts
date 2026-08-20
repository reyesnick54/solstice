/**
 * Chunk 130 — Compute and AI compute economic data provider fabric.
 *
 * Provider-neutral metering architecture for general compute, GPU
 * compute, AI inference, AI training, and compute capacity.
 *
 * This layer does not contact live commercial providers, store
 * workload payloads, mint MoonRey, or treat capacity as realized
 * output. Physical token counts are never converted into GPU-time.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { ResourceClass } from '../../../../units/constitution.ts';
import type { ExactQuantity, NormalizationReceipt } from '../../../../units/types.ts';
import type { CanonicalProductiveMeasurement } from '../../../../units/measurement.ts';
import type { IdentityRef } from '../../../../productive/policy-governance/attribution/types.ts';

export const COMPUTE_FABRIC_VERSION = 'sunrey.compute-ai-data-fabric.v1' as const;
export const COMPUTE_FABRIC_SCHEMA_VERSION = 1 as const;

export const REAL_PROVIDER_CONTACTED = false as const;
export const COMPUTE_FACT_AUTO_MINTS_MOONREY = false as const;
export const CERTIFICATION_AUTO_MINTS_MOONREY = false as const;
export const TOKEN_EQUALS_GPU_TIME = false as const;
export const CAPACITY_EQUALS_REALIZED_OUTPUT = false as const;
export const PROMPT_CONTENT_STORED = false as const;
export const MODEL_OUTPUT_STORED = false as const;
export const CREDENTIAL_MATERIAL_STORED = false as const;
export const PRODUCTION_ACTIVE = false as const;

export const COMPUTE_SOURCE_CLASSES = [
  'CLUSTER_SCHEDULER',
  'CLOUD_METERING',
  'GPU_CLUSTER_TELEMETRY',
  'CPU_CLUSTER_TELEMETRY',
  'AI_INFERENCE_GATEWAY',
  'AI_TRAINING_METER',
  'CONTAINER_ORCHESTRATOR',
  'BATCH_JOB_METER',
  'ACCELERATOR_CAPACITY_INVENTORY',
  'EDGE_COMPUTE_METER',
] as const;
export type ComputeSourceClass = (typeof COMPUTE_SOURCE_CLASSES)[number];

export const COMPUTE_FACT_TYPES = [
  'COMPUTE_CAPACITY',
  'COMPUTE_USAGE',
  'AI_INFERENCE_USAGE',
  'AI_COMPUTE_CAPACITY',
  'AI_TRAINING_USAGE',
] as const;
export type ComputeFactType = (typeof COMPUTE_FACT_TYPES)[number];

export const FORBIDDEN_COMPUTE_FACT_TYPES = ['AI_VALUE', 'AI_INTELLIGENCE_VALUE', 'MODEL_IMPORTANCE'] as const;
export type ForbiddenComputeFactType = (typeof FORBIDDEN_COMPUTE_FACT_TYPES)[number];

export const COMPUTE_TIME_BASES = [
  'WALL_CLOCK_SECONDS',
  'CPU_SECONDS',
  'GPU_SECONDS',
  'GENERIC_COMPUTE_SECONDS',
] as const;
export type ComputeTimeBase = (typeof COMPUTE_TIME_BASES)[number];

export const COMPUTE_QUANTITY_SEMANTICS = ['WALL_DURATION', 'RESOURCE_TIME'] as const;
export type ComputeQuantitySemantic = (typeof COMPUTE_QUANTITY_SEMANTICS)[number];

export const COMPUTE_WORKLOAD_CLASSES = ['GENERAL_COMPUTE', 'AI_INFERENCE', 'AI_TRAINING'] as const;
export type ComputeWorkloadClass = (typeof COMPUTE_WORKLOAD_CLASSES)[number];

export const COMPUTE_TOKEN_COMPONENTS = ['INPUT_TOKENS', 'OUTPUT_TOKENS', 'TOTAL_PROCESSED_TOKENS'] as const;
export type ComputeTokenComponent = (typeof COMPUTE_TOKEN_COMPONENTS)[number];

export const COMPUTE_SCHEMA_IDS = [
  'COMPUTE_USAGE_V1',
  'GPU_USAGE_V1',
  'CPU_USAGE_V1',
  'AI_INFERENCE_USAGE_V1',
  'AI_TRAINING_USAGE_V1',
  'AI_COMPUTE_CAPACITY_V1',
] as const;
export type ComputeSchemaId = (typeof COMPUTE_SCHEMA_IDS)[number];

export const COMPUTE_AVAILABILITY_STATES = ['AVAILABLE', 'ALLOCATED', 'MAINTENANCE', 'UNAVAILABLE'] as const;
export type ComputeAvailabilityState = (typeof COMPUTE_AVAILABILITY_STATES)[number];

export const COMPUTE_REFUSAL_CODES = [
  'NORMALIZATION_CONTEXT_REQUIRED',
  'WALL_TIME_LABELED_AS_GPU_TIME',
  'GPU_COUNT_OMITTED',
  'RESOURCE_COUNT_REQUIRED',
  'TOKEN_GPU_CONVERSION_FORBIDDEN',
  'TRAINING_INFERENCE_TOKEN_SEMANTIC',
  'TOKEN_COMPONENT_NOT_INFERENCE',
  'CAPACITY_IS_NOT_REALIZED_USAGE',
  'WORKLOAD_CLASS_REQUIRED',
  'WORKLOAD_CLASS_NOT_INFERRED_FROM_PROVIDER',
  'FORBIDDEN_FACT_TYPE',
  'PROMPT_CONTENT_FORBIDDEN',
  'MODEL_OUTPUT_FORBIDDEN',
  'CREDENTIAL_MATERIAL_FORBIDDEN',
  'WORKLOAD_PAYLOAD_FORBIDDEN',
  'FLOAT_USAGE_FORBIDDEN',
  'STALE_JOB',
  'UTILIZATION_DIMENSION_MISMATCH',
  'ENERGY_PRODUCTION_CLAIMED_AS_OWN',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'SCHEMA_INCOMPATIBLE',
  'INCOMPATIBLE_DIMENSION',
] as const;
export type ComputeRefusalCode = (typeof COMPUTE_REFUSAL_CODES)[number];

export type ComputeRefusal = {
  readonly code: ComputeRefusalCode;
  readonly detail: string;
};

/**
 * Privacy-safe execution identity. Opaque hashed refs only.
 * No prompt, model output, source code, or customer filename.
 */
export type ComputeEconomicExecutionReference = {
  readonly schemaVersion: typeof COMPUTE_FABRIC_SCHEMA_VERSION;
  readonly executionRef: IdentityRef;
  readonly jobRef: IdentityRef;
  readonly clusterRef: IdentityRef;
  readonly resourcePoolRef: IdentityRef;
  readonly controllerRef: IdentityRef;
  readonly measurementStart: bigint;
  readonly measurementEnd: bigint;
  readonly resourceClass: ResourceClass | null;
  readonly resourceCount: bigint | null;
  readonly workloadClass: ComputeWorkloadClass;
  readonly promptContentStored: false;
  readonly modelOutputStored: false;
  readonly credentialMaterialStored: false;
};

export type ComputeTokenBreakdown = {
  readonly inputTokens: bigint | null;
  readonly outputTokens: bigint | null;
  readonly totalProcessedTokens: bigint | null;
  readonly component: ComputeTokenComponent;
  readonly mapsToTokenInference: boolean;
};

export type ComputeEnergyLineage = {
  readonly energyConsumptionFactRef: IdentityRef | null;
  readonly claimsEnergyProduction: false;
};

export type ComputeCapacityInventory = {
  readonly resourceClass: ResourceClass;
  readonly resourceCount: bigint;
  readonly availableDurationSeconds: bigint;
  readonly region: string;
  readonly availabilityState: ComputeAvailabilityState;
};

export type ComputeUtilization = {
  readonly actualResourceTime: ExactQuantity;
  readonly capacityResourceTime: ExactQuantity;
  readonly utilizationNumerator: bigint;
  readonly utilizationDenominator: bigint;
  readonly matchingPeriod: true;
  readonly matchingDimension: true;
};

export type ComputeSourceObservation = {
  readonly sourceClass: ComputeSourceClass;
  readonly schemaId: ComputeSchemaId;
  readonly schemaVersion: 1;
  readonly factType: ComputeFactType;
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly identifier: string;
  readonly numericValue: string;
  readonly unit: UnitCode | 'cpu_s' | 'GPU_HOUR' | 'CPU_HOUR';
  readonly sourceTimestampUnix: string;
  readonly timeBase: ComputeTimeBase;
  readonly quantitySemantic: ComputeQuantitySemantic;
  readonly wallClockSeconds: bigint | null;
  readonly resourceClass: ResourceClass | null;
  readonly resourceCount: bigint | null;
  readonly workloadClass: ComputeWorkloadClass;
  readonly region: string;
  readonly executionId: string;
  readonly jobId: string;
  readonly clusterId: string;
  readonly resourcePoolId: string;
  readonly controllerId: string;
  readonly accountControllerId: string;
  readonly measurementStart: bigint;
  readonly measurementEnd: bigint;
  readonly tokenBreakdown?: ComputeTokenBreakdown | undefined;
  readonly capacity?: ComputeCapacityInventory | undefined;
  readonly energyConsumptionFactRef?: string | undefined;
  readonly energyProductionFactRef?: string | undefined;
  readonly extras?: Readonly<Record<string, unknown>> | undefined;
};

export type ComputeEconomicRecord = {
  readonly fabricVersion: typeof COMPUTE_FABRIC_VERSION;
  readonly schemaId: ComputeSchemaId;
  readonly factType: ComputeFactType;
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly sourceClass: ComputeSourceClass;
  readonly execution: ComputeEconomicExecutionReference;
  readonly sourceQuantity: ExactQuantity;
  readonly canonicalQuantity: ExactQuantity;
  readonly canonicalUnit: string;
  readonly dimension: string;
  readonly measurement: CanonicalProductiveMeasurement;
  readonly receipt: NormalizationReceipt;
  readonly tokenBreakdown: ComputeTokenBreakdown | null;
  readonly capacity: ComputeCapacityInventory | null;
  readonly energyLineage: ComputeEnergyLineage | null;
  readonly promptContentStored: false;
  readonly modelOutputStored: false;
  readonly credentialMaterialStored: false;
  readonly tokenEqualsGpuTime: false;
  readonly capacityEqualsRealizedOutput: false;
  readonly realProviderContacted: false;
  readonly computeFactAutoMintsMoonRey: false;
};

export function isComputeSourceClass(value: string): value is ComputeSourceClass {
  return (COMPUTE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isComputeFactType(value: string): value is ComputeFactType {
  return (COMPUTE_FACT_TYPES as readonly string[]).includes(value);
}

export function isForbiddenComputeFactType(value: string): value is ForbiddenComputeFactType {
  return (FORBIDDEN_COMPUTE_FACT_TYPES as readonly string[]).includes(value);
}

export function computeFactDoesNotMintMoonRey(): false {
  return COMPUTE_FACT_AUTO_MINTS_MOONREY;
}

export function tokensAreNotGpuTime(): false {
  return TOKEN_EQUALS_GPU_TIME;
}

export function capacityIsNotRealizedOutput(): false {
  return CAPACITY_EQUALS_REALIZED_OUTPUT;
}

export function computeRefusal(code: ComputeRefusalCode, detail: string): ComputeRefusal {
  return Object.freeze({ code, detail });
}

export type { FactType, UnitCode, ClaimType, ProductiveCategory, ResourceClass };
