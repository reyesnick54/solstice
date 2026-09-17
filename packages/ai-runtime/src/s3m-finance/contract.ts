import type { UtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { AiApprovedPurpose } from '../taxonomy.ts';
import type { S3mFinanceModelProfile } from './model-profile.ts';
import { S3M_FINANCE_PROFILE_KEY } from './model-profile.ts';
import type { S3mFinanceReasoningResult } from './structured-output.ts';
import { S3M_FINANCE_REASONING_SCHEMA } from './structured-output.ts';
import type {
  S3mAuthorizedContextClass,
  S3mFallbackPolicy,
  S3mPrivacyClassification,
  S3mSafetyStatus,
} from './taxonomy.ts';
import { S3M_PRIVACY_CLASSIFICATIONS, S3M_REASONING_NEXT_STATES } from './taxonomy.ts';

export type S3mAuthorizedContextField = {
  readonly fieldId: string;
  readonly contextClass: S3mAuthorizedContextClass;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly sourceRef: string | null;
};

export type S3mUsageLimits = {
  readonly maxInputTokens: number | null;
  readonly maxOutputTokens: number | null;
  readonly maxComputeUnits: number | null;
  readonly costCeilingMicros: string | null;
};

export type S3mFinanceServingRequest = {
  readonly inferenceRequestId: string;
  readonly workOrderRef: string | null;
  readonly taskRef: string | null;
  readonly purpose: AiApprovedPurpose;
  readonly authorizedContext: readonly S3mAuthorizedContextField[];
  readonly privacyClassification: S3mPrivacyClassification;
  readonly modelProfile: typeof S3M_FINANCE_PROFILE_KEY;
  readonly permittedTools: readonly string[];
  readonly structuredOutputSchema: typeof S3M_FINANCE_REASONING_SCHEMA;
  readonly usageLimits: S3mUsageLimits;
  readonly deadline: UtcInstant | null;
  readonly userId: string;
  readonly correlationId: string;
  readonly fallbackPolicy: S3mFallbackPolicy;
};

export type S3mServingEvidence = {
  readonly qualificationState: string;
  readonly deploymentId: string;
  readonly modelVersion: string;
  readonly servingVersion: string;
  readonly endpointServiceIdentity: string | null;
  readonly evidenceRef: string | null;
  readonly requestHash: string;
  readonly responseHash: string | null;
};

export type S3mServingUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly computeUnits: number | null;
  readonly gpuDurationMs: number | null;
  readonly estimatedCostMicros: string;
  readonly latencyMs: number;
};

export type S3mFinanceServingResponse = {
  readonly inferenceRequestId: string;
  readonly modelId: string;
  readonly deploymentId: string;
  readonly modelVersion: string;
  readonly servingVersion: string;
  readonly result: S3mFinanceReasoningResult | null;
  readonly structuredOutputValid: boolean;
  readonly modelConfidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  readonly usage: S3mServingUsage | null;
  readonly timing: {
    readonly startedAt: UtcInstant;
    readonly completedAt: UtcInstant;
    readonly latencyMs: number;
  };
  readonly servingEvidence: S3mServingEvidence;
  readonly safetyStatus: S3mSafetyStatus;
  readonly degraded: boolean;
  readonly errorCode: string | null;
  readonly errorDetail: string | null;
  readonly grantsExecutionAuthority: false;
  readonly selfAuthorizes: false;
};

export type S3mContractValidationFailure = {
  readonly code:
    | 'INVALID_REQUEST'
    | 'UNSUPPORTED_SCHEMA'
    | 'UNSUPPORTED_PROFILE'
    | 'DEADLINE_EXPIRED'
    | 'USAGE_LIMIT_EXCEEDED';
  readonly detail: string;
};

export function validateS3mFinanceServingRequest(
  request: S3mFinanceServingRequest,
  now: UtcInstant,
): Result<true, S3mContractValidationFailure> {
  if (!request.inferenceRequestId || request.inferenceRequestId.length === 0) {
    return err({ code: 'INVALID_REQUEST', detail: 'inferenceRequestId is required' });
  }
  if (request.modelProfile !== S3M_FINANCE_PROFILE_KEY) {
    return err({ code: 'UNSUPPORTED_PROFILE', detail: `unsupported model profile ${request.modelProfile}` });
  }
  if (request.structuredOutputSchema !== S3M_FINANCE_REASONING_SCHEMA) {
    return err({ code: 'UNSUPPORTED_SCHEMA', detail: `unsupported schema ${request.structuredOutputSchema}` });
  }
  if (!S3M_PRIVACY_CLASSIFICATIONS.includes(request.privacyClassification)) {
    return err({ code: 'INVALID_REQUEST', detail: `invalid privacy classification ${request.privacyClassification}` });
  }
  if (request.deadline && request.deadline < now) {
    return err({ code: 'DEADLINE_EXPIRED', detail: 'request deadline has passed' });
  }
  if (request.usageLimits.maxOutputTokens !== null && request.usageLimits.maxOutputTokens <= 0) {
    return err({ code: 'USAGE_LIMIT_EXCEEDED', detail: 'maxOutputTokens must be positive' });
  }
  return ok(true);
}

export function buildServingEvidence(input: {
  readonly profile: S3mFinanceModelProfile;
  readonly requestHash: string;
  readonly responseHash: string | null;
}): S3mServingEvidence {
  return Object.freeze({
    qualificationState: input.profile.qualificationState,
    deploymentId: input.profile.deploymentId,
    modelVersion: input.profile.modelVersion,
    servingVersion: input.profile.servingVersion,
    endpointServiceIdentity: input.profile.endpointServiceIdentity,
    evidenceRef: input.profile.approvalEvidenceRef,
    requestHash: input.requestHash,
    responseHash: input.responseHash,
  });
}

export function refusedResponse(input: {
  readonly request: S3mFinanceServingRequest;
  readonly profile: S3mFinanceModelProfile;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant;
  readonly requestHash: string;
  readonly errorCode: string;
  readonly errorDetail: string;
  readonly safetyStatus: S3mSafetyStatus;
}): S3mFinanceServingResponse {
  return Object.freeze({
    inferenceRequestId: input.request.inferenceRequestId,
    modelId: input.profile.modelId,
    deploymentId: input.profile.deploymentId,
    modelVersion: input.profile.modelVersion,
    servingVersion: input.profile.servingVersion,
    result: null,
    structuredOutputValid: false,
    modelConfidence: null,
    usage: null,
    timing: Object.freeze({
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      latencyMs: 0,
    }),
    servingEvidence: buildServingEvidence({
      profile: input.profile,
      requestHash: input.requestHash,
      responseHash: null,
    }),
    safetyStatus: input.safetyStatus,
    degraded: input.safetyStatus === 'DEGRADED',
    errorCode: input.errorCode,
    errorDetail: input.errorDetail,
    grantsExecutionAuthority: false,
    selfAuthorizes: false,
  });
}

export function isValidNextState(value: string): boolean {
  return (S3M_REASONING_NEXT_STATES as readonly string[]).includes(value);
}
