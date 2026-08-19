import { asUtcInstant } from '../../domain/src/time.ts';
import { requestIdFor } from './ids.ts';
import { createDefaultAiRuntimePolicy } from './policy.ts';
import {
  CANONICAL_LOCAL_TEST_MODEL_ID,
  CANONICAL_LOCAL_TEST_MODEL_VERSION,
  CANONICAL_S3M_MODEL_ID,
  CANONICAL_S3M_MODEL_VERSION,
} from './registry.ts';
import { CANONICAL_LOCAL_TEST_MODEL_ID, CANONICAL_LOCAL_TEST_MODEL_VERSION } from './registry.ts';
import type { AiDataClass, AiRuntimeMode, AiTaskClass, LocalTestFixture } from './taxonomy.ts';
import type { AiInferenceRequest, AiRuntimePolicy } from './types.ts';

export const AI_RUNTIME_NOW = asUtcInstant('2026-08-19T12:00:00.000Z');

export function defaultAiPolicy(mode: AiRuntimeMode = 'S3M_PRIMARY'): AiRuntimePolicy {
  return createDefaultAiRuntimePolicy(mode);
}

export function localTestRequest(overrides: {
  readonly taskClass?: AiTaskClass;
  readonly mode?: AiRuntimeMode;
  readonly dataClass?: AiDataClass;
  readonly fixture?: LocalTestFixture;
  readonly prompt?: string;
  readonly userApprovedExternal?: boolean;
  readonly jurisdictionRef?: string | null;
  readonly context?: AiInferenceRequest['context'];
} = {}): AiInferenceRequest {
  return Object.freeze({
    requestId: requestIdFor(`test:${overrides.fixture ?? 'normal'}:${overrides.taskClass ?? 'GENERAL_ASSISTANT'}`),
    taskClass: overrides.taskClass ?? 'GENERAL_ASSISTANT',
    mode: overrides.mode ?? 'S3M_PRIMARY',
    modelRef: { modelId: CANONICAL_LOCAL_TEST_MODEL_ID, version: CANONICAL_LOCAL_TEST_MODEL_VERSION },
    dataClass: overrides.dataClass ?? 'SYNTHETIC',
    jurisdictionRef: overrides.jurisdictionRef === undefined ? 'SIM' : overrides.jurisdictionRef,
    authorization: Object.freeze({
      actorId: 'user_1',
      subjectId: 'user_1',
      userApprovedExternal: overrides.userApprovedExternal ?? false,
      mandateId: 'uam_demo',
      agentId: 'uag_demo',
    }),
    prompt: overrides.prompt ?? 'Explain my simulation balances',
    context: Object.freeze(overrides.context ?? []),
    ...(overrides.fixture ? { fixture: overrides.fixture } : {}),
  });
}

export function s3mRequest(overrides: Parameters<typeof localTestRequest>[0] = {}): AiInferenceRequest {
  return Object.freeze({
    ...localTestRequest(overrides),
    modelRef: { modelId: CANONICAL_S3M_MODEL_ID, version: CANONICAL_S3M_MODEL_VERSION },
  });
}
