/**
 * Versioned provider-neutral compute feed schemas.
 *
 * Breaking semantic changes create a new schema version. These
 * schemas describe economic metering fields only.
 */

import type { FeedSchemaDefinition } from '../../types.ts';
import type { ComputeFactType, ComputeSchemaId, ComputeWorkloadClass } from './types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { ProductiveCategory } from '../../../../productive/types.ts';
import type { UnitCode } from '../../../types.ts';

export type ComputeFeedSchema = FeedSchemaDefinition & {
  readonly computeSchemaId: ComputeSchemaId;
  readonly dataSourceCategory: DataSourceCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly requiredWorkloadClass: ComputeWorkloadClass | null;
  readonly requiresResourceClass: boolean;
  readonly requiresResourceCount: boolean;
  readonly tokenSemantic: 'INFERENCE_PROCESSED_TOKENS' | null;
  readonly capacitySchema: boolean;
};

function schema(input: {
  readonly computeSchemaId: ComputeSchemaId;
  readonly schemaId: string;
  readonly factType: ComputeFactType;
  readonly unit: UnitCode;
  readonly dataSourceCategory: DataSourceCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly requiredFields: readonly string[];
  readonly requiredWorkloadClass: ComputeWorkloadClass | null;
  readonly requiresResourceClass: boolean;
  readonly requiresResourceCount: boolean;
  readonly tokenSemantic?: 'INFERENCE_PROCESSED_TOKENS' | null;
  readonly capacitySchema?: boolean;
}): ComputeFeedSchema {
  return Object.freeze({
    schemaVersion: 1,
    schemaId: input.schemaId,
    version: 1,
    factType: input.factType,
    requiredFields: Object.freeze([...input.requiredFields]),
    unit: input.unit,
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
    computeSchemaId: input.computeSchemaId,
    dataSourceCategory: input.dataSourceCategory,
    productiveCategory: input.productiveCategory,
    requiredWorkloadClass: input.requiredWorkloadClass,
    requiresResourceClass: input.requiresResourceClass,
    requiresResourceCount: input.requiresResourceCount,
    tokenSemantic: input.tokenSemantic ?? null,
    capacitySchema: input.capacitySchema ?? false,
  });
}

const METER_FIELDS = Object.freeze([
  'identifier',
  'numericValue',
  'unit',
  'sourceTimestampUnix',
  'executionId',
  'workloadClass',
  'measurementStart',
  'measurementEnd',
]);

export const COMPUTE_FEED_SCHEMAS: Readonly<Record<ComputeSchemaId, ComputeFeedSchema>> = Object.freeze({
  COMPUTE_USAGE_V1: schema({
    computeSchemaId: 'COMPUTE_USAGE_V1',
    schemaId: 'compute.usage.v1',
    factType: 'COMPUTE_USAGE',
    unit: 'compute_s',
    dataSourceCategory: 'compute',
    productiveCategory: 'COMPUTE',
    requiredFields: [...METER_FIELDS, 'resourceClass'],
    requiredWorkloadClass: 'GENERAL_COMPUTE',
    requiresResourceClass: true,
    requiresResourceCount: true,
  }),
  GPU_USAGE_V1: schema({
    computeSchemaId: 'GPU_USAGE_V1',
    schemaId: 'compute.gpu-usage.v1',
    factType: 'COMPUTE_USAGE',
    unit: 'gpu_s',
    dataSourceCategory: 'compute',
    productiveCategory: 'COMPUTE',
    requiredFields: [...METER_FIELDS, 'resourceClass', 'resourceCount'],
    requiredWorkloadClass: null,
    requiresResourceClass: true,
    requiresResourceCount: true,
  }),
  CPU_USAGE_V1: schema({
    computeSchemaId: 'CPU_USAGE_V1',
    schemaId: 'compute.cpu-usage.v1',
    factType: 'COMPUTE_USAGE',
    unit: 'compute_s',
    dataSourceCategory: 'compute',
    productiveCategory: 'COMPUTE',
    requiredFields: [...METER_FIELDS, 'resourceClass', 'resourceCount'],
    requiredWorkloadClass: 'GENERAL_COMPUTE',
    requiresResourceClass: true,
    requiresResourceCount: true,
  }),
  AI_INFERENCE_USAGE_V1: schema({
    computeSchemaId: 'AI_INFERENCE_USAGE_V1',
    schemaId: 'ai.inference-usage.v1',
    factType: 'AI_INFERENCE_USAGE',
    unit: 'token_inference',
    dataSourceCategory: 'ai_compute',
    productiveCategory: 'AI_COMPUTE',
    requiredFields: [...METER_FIELDS, 'tokenComponent'],
    requiredWorkloadClass: 'AI_INFERENCE',
    requiresResourceClass: false,
    requiresResourceCount: false,
    tokenSemantic: 'INFERENCE_PROCESSED_TOKENS',
  }),
  AI_TRAINING_USAGE_V1: schema({
    computeSchemaId: 'AI_TRAINING_USAGE_V1',
    schemaId: 'ai.training-usage.v1',
    factType: 'AI_TRAINING_USAGE',
    unit: 'gpu_s',
    dataSourceCategory: 'ai_compute',
    productiveCategory: 'AI_COMPUTE',
    requiredFields: [...METER_FIELDS, 'resourceClass', 'resourceCount'],
    requiredWorkloadClass: 'AI_TRAINING',
    requiresResourceClass: true,
    requiresResourceCount: true,
  }),
  AI_COMPUTE_CAPACITY_V1: schema({
    computeSchemaId: 'AI_COMPUTE_CAPACITY_V1',
    schemaId: 'ai.compute-capacity.v1',
    factType: 'AI_COMPUTE_CAPACITY',
    unit: 'gpu_s',
    dataSourceCategory: 'ai_compute',
    productiveCategory: 'AI_COMPUTE',
    requiredFields: [
      'identifier',
      'numericValue',
      'unit',
      'sourceTimestampUnix',
      'resourceClass',
      'resourceCount',
      'availableDurationSeconds',
    ],
    requiredWorkloadClass: null,
    requiresResourceClass: true,
    requiresResourceCount: true,
    capacitySchema: true,
  }),
});

export function computeFeedSchema(id: ComputeSchemaId): ComputeFeedSchema {
  return COMPUTE_FEED_SCHEMAS[id];
}

export function breakingComputeSchemaRequiresNewVersion(): true {
  return true;
}
