/**
 * Provider-neutral compute source-class profiles.
 *
 * Named commercial vendors are not required. A scheduler, billing
 * export, and usage API from the same organization remain one
 * controller under Chunk 128 independence rules.
 */

import type { DataSourceCategory } from '../../types.ts';
import type { ComputeFactType, ComputeSourceClass, ComputeWorkloadClass } from './types.ts';

export type ComputeSourceProfile = {
  readonly sourceClass: ComputeSourceClass;
  readonly dataSourceCategory: DataSourceCategory;
  readonly defaultFactType: ComputeFactType;
  readonly allowedFactTypes: readonly ComputeFactType[];
  readonly allowedWorkloadClasses: readonly ComputeWorkloadClass[];
  readonly mayDescribeCapacity: boolean;
  readonly corroboratingOnly: boolean;
  readonly namedVendorRequired: false;
};

const GENERAL: readonly ComputeWorkloadClass[] = Object.freeze(['GENERAL_COMPUTE']);
const INFERENCE: readonly ComputeWorkloadClass[] = Object.freeze(['AI_INFERENCE']);
const TRAINING: readonly ComputeWorkloadClass[] = Object.freeze(['AI_TRAINING']);
const ANY_WORKLOAD: readonly ComputeWorkloadClass[] = Object.freeze([
  'GENERAL_COMPUTE',
  'AI_INFERENCE',
  'AI_TRAINING',
]);

function profile(
  sourceClass: ComputeSourceClass,
  dataSourceCategory: DataSourceCategory,
  defaultFactType: ComputeFactType,
  allowedFactTypes: readonly ComputeFactType[],
  allowedWorkloadClasses: readonly ComputeWorkloadClass[],
  mayDescribeCapacity: boolean,
): ComputeSourceProfile {
  return Object.freeze({
    sourceClass,
    dataSourceCategory,
    defaultFactType,
    allowedFactTypes,
    allowedWorkloadClasses,
    mayDescribeCapacity,
    corroboratingOnly: true,
    namedVendorRequired: false,
  });
}

export const COMPUTE_SOURCE_PROFILES: Readonly<Record<ComputeSourceClass, ComputeSourceProfile>> = Object.freeze({
  CLUSTER_SCHEDULER: profile(
    'CLUSTER_SCHEDULER',
    'compute',
    'COMPUTE_USAGE',
    ['COMPUTE_USAGE', 'COMPUTE_CAPACITY', 'AI_TRAINING_USAGE', 'AI_COMPUTE_CAPACITY'],
    ANY_WORKLOAD,
    true,
  ),
  CLOUD_METERING: profile(
    'CLOUD_METERING',
    'compute',
    'COMPUTE_USAGE',
    ['COMPUTE_USAGE', 'AI_INFERENCE_USAGE', 'AI_TRAINING_USAGE', 'COMPUTE_CAPACITY', 'AI_COMPUTE_CAPACITY'],
    ANY_WORKLOAD,
    true,
  ),
  GPU_CLUSTER_TELEMETRY: profile(
    'GPU_CLUSTER_TELEMETRY',
    'compute',
    'COMPUTE_USAGE',
    ['COMPUTE_USAGE', 'AI_TRAINING_USAGE', 'AI_COMPUTE_CAPACITY'],
    ANY_WORKLOAD,
    true,
  ),
  CPU_CLUSTER_TELEMETRY: profile(
    'CPU_CLUSTER_TELEMETRY',
    'compute',
    'COMPUTE_USAGE',
    ['COMPUTE_USAGE', 'COMPUTE_CAPACITY'],
    GENERAL,
    true,
  ),
  AI_INFERENCE_GATEWAY: profile(
    'AI_INFERENCE_GATEWAY',
    'ai_compute',
    'AI_INFERENCE_USAGE',
    ['AI_INFERENCE_USAGE'],
    INFERENCE,
    false,
  ),
  AI_TRAINING_METER: profile(
    'AI_TRAINING_METER',
    'ai_compute',
    'AI_TRAINING_USAGE',
    ['AI_TRAINING_USAGE'],
    TRAINING,
    false,
  ),
  CONTAINER_ORCHESTRATOR: profile(
    'CONTAINER_ORCHESTRATOR',
    'compute',
    'COMPUTE_USAGE',
    ['COMPUTE_USAGE', 'COMPUTE_CAPACITY'],
    ANY_WORKLOAD,
    true,
  ),
  BATCH_JOB_METER: profile(
    'BATCH_JOB_METER',
    'compute',
    'COMPUTE_USAGE',
    ['COMPUTE_USAGE', 'AI_TRAINING_USAGE'],
    ANY_WORKLOAD,
    false,
  ),
  ACCELERATOR_CAPACITY_INVENTORY: profile(
    'ACCELERATOR_CAPACITY_INVENTORY',
    'ai_compute',
    'AI_COMPUTE_CAPACITY',
    ['AI_COMPUTE_CAPACITY', 'COMPUTE_CAPACITY'],
    ANY_WORKLOAD,
    true,
  ),
  EDGE_COMPUTE_METER: profile(
    'EDGE_COMPUTE_METER',
    'compute',
    'COMPUTE_USAGE',
    ['COMPUTE_USAGE', 'COMPUTE_CAPACITY', 'AI_INFERENCE_USAGE'],
    ANY_WORKLOAD,
    true,
  ),
});

export function profileFor(sourceClass: ComputeSourceClass): ComputeSourceProfile {
  return COMPUTE_SOURCE_PROFILES[sourceClass];
}

export function namedVendorIsNotRequired(): false {
  return false;
}
