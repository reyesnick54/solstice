import type { UtcInstant } from '../../domain/src/time.ts';
import type { AiProviderKind } from './taxonomy.ts';
import type { AiModelReference } from './types.ts';

export const TOOL_SCHEMA_VERSION = 'sunrey-ai-tool-intent.v1' as const;

export type OutputValidationStatus = 'ACCEPTED' | 'REPAIRED' | 'REJECTED' | 'NOT_REQUIRED';

export type ModelResponseProvenance = {
  readonly model: AiModelReference;
  readonly provider: AiProviderKind;
  readonly version: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly requestId: string;
  readonly timestamp: UtcInstant;
  readonly toolSchemaVersion: typeof TOOL_SCHEMA_VERSION;
  readonly outputValidationStatus: OutputValidationStatus;
  readonly storedHiddenReasoning: false;
};

export function buildProvenance(input: {
  readonly model: AiModelReference;
  readonly provider: AiProviderKind;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly requestId: string;
  readonly timestamp: UtcInstant;
  readonly outputValidationStatus: OutputValidationStatus;
}): ModelResponseProvenance {
  return Object.freeze({
    model: input.model,
    provider: input.provider,
    version: input.model.version,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    requestId: input.requestId,
    timestamp: input.timestamp,
    toolSchemaVersion: TOOL_SCHEMA_VERSION,
    outputValidationStatus: input.outputValidationStatus,
    storedHiddenReasoning: false,
  });
}
