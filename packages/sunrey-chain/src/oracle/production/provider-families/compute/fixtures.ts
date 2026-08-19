/**
 * Deterministic sandbox compute fixtures. Not commercial providers.
 */

import type { ComputeSourceClass, ComputeSourceObservation, ComputeWorkloadClass } from './types.ts';

export const SANDBOX_NOW = 1_700_000_000n;
export const SANDBOX_START = 1_699_999_990n;
export const SANDBOX_END = 1_700_000_000n;
export const SANDBOX_EXECUTION = 'exec.sandbox.gpu.1';
export const SANDBOX_JOB = 'job.sandbox.train-or-infer.1';
export const SANDBOX_CLUSTER = 'cluster.sandbox.a';
export const SANDBOX_POOL = 'pool.sandbox.gpu';
export const SANDBOX_CONTROLLER = 'controller.sandbox.cloud';

function base(overrides: Partial<ComputeSourceObservation> = {}): ComputeSourceObservation {
  return Object.freeze({
    sourceClass: overrides.sourceClass ?? 'GPU_CLUSTER_TELEMETRY',
    schemaId: overrides.schemaId ?? 'GPU_USAGE_V1',
    schemaVersion: 1,
    factType: overrides.factType ?? 'COMPUTE_USAGE',
    productiveCategory: overrides.productiveCategory ?? 'COMPUTE',
    claimType: overrides.claimType ?? 'USAGE',
    identifier: overrides.identifier ?? 'cluster_sandbox_1',
    numericValue: overrides.numericValue ?? '80',
    unit: overrides.unit ?? 'gpu_s',
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? SANDBOX_NOW.toString(),
    timeBase: overrides.timeBase ?? 'GPU_SECONDS',
    quantitySemantic: overrides.quantitySemantic ?? 'RESOURCE_TIME',
    wallClockSeconds: overrides.wallClockSeconds ?? 10n,
    resourceClass: Object.hasOwn(overrides, 'resourceClass') ? overrides.resourceClass ?? null : 'GPU',
    resourceCount: Object.hasOwn(overrides, 'resourceCount') ? overrides.resourceCount ?? null : 8n,
    workloadClass: overrides.workloadClass ?? 'GENERAL_COMPUTE',
    region: overrides.region ?? 'sandbox-east',
    executionId: overrides.executionId ?? SANDBOX_EXECUTION,
    jobId: overrides.jobId ?? SANDBOX_JOB,
    clusterId: overrides.clusterId ?? SANDBOX_CLUSTER,
    resourcePoolId: overrides.resourcePoolId ?? SANDBOX_POOL,
    controllerId: overrides.controllerId ?? SANDBOX_CONTROLLER,
    accountControllerId: overrides.accountControllerId ?? SANDBOX_CONTROLLER,
    measurementStart: overrides.measurementStart ?? SANDBOX_START,
    measurementEnd: overrides.measurementEnd ?? SANDBOX_END,
    tokenBreakdown: overrides.tokenBreakdown,
    capacity: overrides.capacity,
    energyConsumptionFactRef: overrides.energyConsumptionFactRef,
    energyProductionFactRef: overrides.energyProductionFactRef,
    extras: overrides.extras,
  });
}

export function gpuExecutionFixture(resourceCount = 8n, wallSeconds = 10n): ComputeSourceObservation {
  return base({
    sourceClass: 'GPU_CLUSTER_TELEMETRY',
    schemaId: 'GPU_USAGE_V1',
    numericValue: (resourceCount * wallSeconds).toString(),
    wallClockSeconds: wallSeconds,
    resourceCount,
    timeBase: 'GPU_SECONDS',
    quantitySemantic: 'RESOURCE_TIME',
  });
}

export function gpuWallDurationFixture(resourceCount = 8n, wallSeconds = 10n): ComputeSourceObservation {
  return base({
    numericValue: wallSeconds.toString(),
    wallClockSeconds: wallSeconds,
    resourceCount,
    quantitySemantic: 'WALL_DURATION',
    timeBase: 'WALL_CLOCK_SECONDS',
    unit: 'gpu_s',
  });
}

export function cpuExecutionFixture(): ComputeSourceObservation {
  return base({
    sourceClass: 'CPU_CLUSTER_TELEMETRY',
    schemaId: 'CPU_USAGE_V1',
    factType: 'COMPUTE_USAGE',
    identifier: 'cpu_cluster_sandbox_1',
    numericValue: '40',
    unit: 'compute_s',
    timeBase: 'CPU_SECONDS',
    quantitySemantic: 'RESOURCE_TIME',
    wallClockSeconds: 10n,
    resourceClass: 'CPU',
    resourceCount: 4n,
    workloadClass: 'GENERAL_COMPUTE',
  });
}

export function genericComputeMissingClassFixture(): ComputeSourceObservation {
  return base({
    sourceClass: 'CLUSTER_SCHEDULER',
    schemaId: 'COMPUTE_USAGE_V1',
    numericValue: '10',
    unit: 'compute_s',
    timeBase: 'GENERIC_COMPUTE_SECONDS',
    quantitySemantic: 'RESOURCE_TIME',
    resourceClass: null,
    resourceCount: null,
    wallClockSeconds: 10n,
  });
}

export function genericComputeWithClassFixture(resourceClass: 'CPU' | 'GPU'): ComputeSourceObservation {
  return base({
    sourceClass: resourceClass === 'GPU' ? 'CLUSTER_SCHEDULER' : 'CPU_CLUSTER_TELEMETRY',
    schemaId: resourceClass === 'GPU' ? 'COMPUTE_USAGE_V1' : 'CPU_USAGE_V1',
    numericValue: '10',
    unit: 'compute_s',
    timeBase: 'GENERIC_COMPUTE_SECONDS',
    quantitySemantic: 'WALL_DURATION',
    resourceClass,
    resourceCount: resourceClass === 'GPU' ? 8n : 4n,
    wallClockSeconds: 10n,
  });
}

export function inferenceTokenFixture(): ComputeSourceObservation {
  return base({
    sourceClass: 'AI_INFERENCE_GATEWAY',
    schemaId: 'AI_INFERENCE_USAGE_V1',
    factType: 'AI_INFERENCE_USAGE',
    productiveCategory: 'AI_COMPUTE',
    identifier: 'gateway_sandbox_1',
    numericValue: '1200',
    unit: 'token_inference',
    timeBase: 'GENERIC_COMPUTE_SECONDS',
    quantitySemantic: 'RESOURCE_TIME',
    resourceClass: null,
    resourceCount: null,
    workloadClass: 'AI_INFERENCE',
    tokenBreakdown: Object.freeze({
      inputTokens: 800n,
      outputTokens: 400n,
      totalProcessedTokens: 1200n,
      component: 'TOTAL_PROCESSED_TOKENS',
      mapsToTokenInference: true,
    }),
  });
}

export function trainingGpuFixture(): ComputeSourceObservation {
  return base({
    sourceClass: 'AI_TRAINING_METER',
    schemaId: 'AI_TRAINING_USAGE_V1',
    factType: 'AI_TRAINING_USAGE',
    productiveCategory: 'AI_COMPUTE',
    identifier: 'train_sandbox_1',
    numericValue: '80',
    unit: 'gpu_s',
    workloadClass: 'AI_TRAINING',
    executionId: 'exec.sandbox.train.1',
    jobId: 'job.sandbox.train.1',
  });
}

export function capacityInventoryFixture(): ComputeSourceObservation {
  return base({
    sourceClass: 'ACCELERATOR_CAPACITY_INVENTORY',
    schemaId: 'AI_COMPUTE_CAPACITY_V1',
    factType: 'AI_COMPUTE_CAPACITY',
    productiveCategory: 'AI_COMPUTE',
    claimType: 'CAPACITY',
    identifier: 'fleet_sandbox_1',
    numericValue: '28800',
    unit: 'gpu_s',
    timeBase: 'GPU_SECONDS',
    quantitySemantic: 'RESOURCE_TIME',
    resourceCount: 8n,
    wallClockSeconds: 3_600n,
    workloadClass: 'GENERAL_COMPUTE',
    capacity: Object.freeze({
      resourceClass: 'GPU',
      resourceCount: 8n,
      availableDurationSeconds: 3_600n,
      region: 'sandbox-east',
      availabilityState: 'AVAILABLE',
    }),
  });
}

export function wallTimeAsGpuFixture(): ComputeSourceObservation {
  return base({
    numericValue: '10',
    wallClockSeconds: 10n,
    resourceCount: 8n,
    timeBase: 'GPU_SECONDS',
    quantitySemantic: 'RESOURCE_TIME',
  });
}

export function gpuCountOmittedFixture(): ComputeSourceObservation {
  return base({
    resourceCount: null,
    timeBase: 'GPU_SECONDS',
    numericValue: '10',
  });
}

export function tokensAsGpuSecondsFixture(): ComputeSourceObservation {
  return base({
    sourceClass: 'CLOUD_METERING',
    schemaId: 'GPU_USAGE_V1',
    factType: 'COMPUTE_USAGE',
    numericValue: '1200',
    unit: 'token_inference',
    timeBase: 'GPU_SECONDS',
    workloadClass: 'GENERAL_COMPUTE',
  });
}

export function trainingLabeledInferenceFixture(): ComputeSourceObservation {
  return base({
    sourceClass: 'AI_TRAINING_METER',
    schemaId: 'AI_TRAINING_USAGE_V1',
    factType: 'AI_TRAINING_USAGE',
    productiveCategory: 'AI_COMPUTE',
    numericValue: '1200',
    unit: 'token_inference',
    workloadClass: 'AI_TRAINING',
    tokenBreakdown: Object.freeze({
      inputTokens: 1200n,
      outputTokens: null,
      totalProcessedTokens: 1200n,
      component: 'TOTAL_PROCESSED_TOKENS',
      mapsToTokenInference: true,
    }),
  });
}

export function promptIncludedFixture(): ComputeSourceObservation {
  return Object.freeze({
    ...inferenceTokenFixture(),
    extras: Object.freeze({ prompt: 'summarize the customer contract' }),
  });
}

export function modelOutputIncludedFixture(): ComputeSourceObservation {
  return Object.freeze({
    ...inferenceTokenFixture(),
    extras: Object.freeze({ model_output: 'the contract is valid' }),
  });
}

export function credentialIncludedFixture(): ComputeSourceObservation {
  return Object.freeze({
    ...gpuExecutionFixture(),
    extras: Object.freeze({ apiKey: 'sandbox-not-a-real-secret' }),
  });
}

export function floatUsageFixture(): ComputeSourceObservation {
  return base({ numericValue: '12.5' });
}

export function staleJobFixture(): ComputeSourceObservation {
  return base({ sourceTimestampUnix: (SANDBOX_NOW - 10_000n).toString() });
}

export function corroboratingSources(
  workloadClass: ComputeWorkloadClass = 'GENERAL_COMPUTE',
): readonly ComputeSourceObservation[] {
  const shared = {
    executionId: SANDBOX_EXECUTION,
    jobId: SANDBOX_JOB,
    clusterId: SANDBOX_CLUSTER,
    resourcePoolId: SANDBOX_POOL,
    controllerId: SANDBOX_CONTROLLER,
    workloadClass,
    numericValue: '80',
    resourceCount: 8n,
    wallClockSeconds: 10n,
  };
  const classes: readonly ComputeSourceClass[] = [
    'CLUSTER_SCHEDULER',
    'CLOUD_METERING',
    'GPU_CLUSTER_TELEMETRY',
  ];
  return Object.freeze(
    classes.map((sourceClass, index) =>
      base({
        ...shared,
        sourceClass,
        schemaId: sourceClass === 'CLUSTER_SCHEDULER' ? 'COMPUTE_USAGE_V1' : 'GPU_USAGE_V1',
        unit: sourceClass === 'CLUSTER_SCHEDULER' ? 'compute_s' : 'gpu_s',
        timeBase: sourceClass === 'CLUSTER_SCHEDULER' ? 'GENERIC_COMPUTE_SECONDS' : 'GPU_SECONDS',
        quantitySemantic: sourceClass === 'CLUSTER_SCHEDULER' ? 'WALL_DURATION' : 'RESOURCE_TIME',
        resourceClass: 'GPU',
        identifier: `src_${sourceClass.toLowerCase()}_${index}`,
      }),
    ),
  );
}
