import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import { canonicalJson, sha256Canonical } from '../ids.ts';
import type { AiGatewayRequest, AiGatewayResult } from '../gateway.ts';
import type { AiProviderFailure } from '../types.ts';
import { buildAuthorizedS3mContext } from './context-builder.ts';
import type { S3mFinanceServingRequest, S3mFinanceServingResponse } from './contract.ts';
import { buildServingEvidence, refusedResponse, validateS3mFinanceServingRequest } from './contract.ts';
import type { S3mFinanceModelProfile } from './model-profile.ts';
import { defaultS3mFinanceModelProfile, onModelVersionChange } from './model-profile.ts';
import { S3mFinanceObservability } from './observability.ts';
import { evaluateQualification, resolveAvailabilityStatus, verifyDeploymentIdentity } from './qualification.ts';
import { validateS3mFinanceReasoningResult } from './structured-output.ts';
import { attributeS3mResearchUsage, buildS3mServingUsage } from './usage-accounting.ts';
import type { S3mAvailabilityStatus, S3mFallbackPolicy } from './taxonomy.ts';
import { s3mPrivacyRequiresPrivateQualification } from './taxonomy.ts';

export type S3mModelGatewayPort = {
  readonly infer: (request: AiGatewayRequest) => Result<AiGatewayResult, AiProviderFailure>;
  readonly cancel: (requestId: string) => boolean;
};

export type S3mFinanceServingFailure = {
  readonly code: string;
  readonly detail: string;
  readonly fallbackPolicy: S3mFallbackPolicy;
};

export type S3mFinanceServingServiceOptions = {
  readonly clock: Clock;
  readonly gateway: S3mModelGatewayPort;
  readonly profile?: S3mFinanceModelProfile;
  readonly observability?: S3mFinanceObservability;
};

/**
 * Canonical S3M-Finance serving boundary. HELIOS and Grow consume this through
 * the Model Gateway — never by calling an S3M endpoint directly.
 */
export class S3mFinanceServingService {
  private readonly clock: Clock;
  private readonly gateway: S3mModelGatewayPort;
  private profile: S3mFinanceModelProfile;
  readonly observability: S3mFinanceObservability;

  constructor(options: S3mFinanceServingServiceOptions) {
    this.clock = options.clock;
    this.gateway = options.gateway;
    this.profile = options.profile ?? defaultS3mFinanceModelProfile(options.clock.now());
    this.observability = options.observability ?? new S3mFinanceObservability();
  }

  getModelProfile(): S3mFinanceModelProfile {
    return this.profile;
  }

  setModelProfile(profile: S3mFinanceModelProfile): void {
    this.profile = profile;
  }

  availabilityStatus(): S3mAvailabilityStatus {
    return resolveAvailabilityStatus(this.profile);
  }

  qualification() {
    return evaluateQualification(this.profile, this.clock.now());
  }

  observe() {
    return this.observability.snapshot(this.profile, this.clock.now());
  }

  cancel(requestId: string): boolean {
    const cancelled = this.gateway.cancel(requestId);
    if (cancelled) {
      this.observability.recordFailure('CANCELLED');
    }
    return cancelled;
  }

  onDeploymentVersionChange(newVersion: S3mFinanceModelProfile['modelVersion']): void {
    this.profile = onModelVersionChange(this.profile, newVersion);
  }

  infer(
    request: S3mFinanceServingRequest,
  ): Result<S3mFinanceServingResponse, S3mFinanceServingFailure> {
    const startedAt = this.clock.now();
    const requestHash = sha256Canonical(
      canonicalJson({
        inferenceRequestId: request.inferenceRequestId,
        purpose: request.purpose,
        privacyClassification: request.privacyClassification,
        workOrderRef: request.workOrderRef,
        taskRef: request.taskRef,
      }),
    );

    const validated = validateS3mFinanceServingRequest(request, startedAt);
    if (!validated.ok) {
      this.observability.recordFailure('GENERAL');
      return err({
        code: validated.error.code,
        detail: validated.error.detail,
        fallbackPolicy: request.fallbackPolicy,
      });
    }

    const contextBuilt = buildAuthorizedS3mContext({ request, profile: this.profile });
    if (!contextBuilt.ok) {
      const kind = contextBuilt.error.code === 'PRIVATE_CONTEXT_NOT_QUALIFIED' ? 'PRIVACY_BLOCKED' : 'GENERAL';
      this.observability.recordFailure(kind);
      const completedAt = this.clock.now();
      return ok(
        refusedResponse({
          request,
          profile: this.profile,
          startedAt,
          completedAt,
          requestHash,
          errorCode: contextBuilt.error.code,
          errorDetail: contextBuilt.error.detail,
          safetyStatus: kind === 'PRIVACY_BLOCKED' ? 'REFUSED' : 'ERROR',
        }),
      );
    }

    const privacyClass = mapPrivacyToGateway(request.privacyClassification);
    const gatewayRequest: AiGatewayRequest = Object.freeze({
      requestId: request.inferenceRequestId as AiGatewayRequest['requestId'],
      purpose: request.purpose,
      taskClass: mapPurposeToTaskClass(request.purpose),
      privacyClass,
      jurisdictionRef: 'SIM',
      authorization: Object.freeze({
        actorId: request.userId,
        subjectId: request.userId,
        userApprovedExternal: false,
        mandateId: request.workOrderRef,
        agentId: null,
      }),
      conversationId: request.correlationId,
      userId: request.userId,
      prompt: buildPrompt(request, contextBuilt.value.fields),
      context: contextBuilt.value.gatewayContext,
      tools: request.permittedTools,
      responseSchema: null,
      correlationId: request.correlationId,
      allowFallback: false,
      preferredProvider: 'S3M',
      costCeilingMicros: request.usageLimits.costCeilingMicros
        ? Number(request.usageLimits.costCeilingMicros)
        : null,
      maxOutputTokens: request.usageLimits.maxOutputTokens,
    });

    const invokeStarted = Date.now();
    const gatewayResult = this.gateway.infer(gatewayRequest);
    const completedAt = this.clock.now();
    const latencyMs = Date.now() - invokeStarted;

    if (!gatewayResult.ok) {
      this.observability.recordFailure('GENERAL');
      const fallback = resolveFallback(request, gatewayResult.error.code);
      return ok(
        refusedResponse({
          request,
          profile: this.profile,
          startedAt,
          completedAt,
          requestHash,
          errorCode: gatewayResult.error.code,
          errorDetail: gatewayResult.error.detail,
          safetyStatus: fallback === 'DEGRADE_TO_PUBLIC_RESEARCH' ? 'DEGRADED' : 'ERROR',
        }),
      );
    }

    const gw = gatewayResult.value;
    if (gw.model) {
      const identityOk = verifyDeploymentIdentity(
        this.profile,
        this.profile.deploymentId,
        this.profile.endpointServiceIdentity,
      );
      const modelOk =
        gw.model.modelId === this.profile.modelId && gw.model.version === this.profile.modelVersion;
      if (!identityOk || !modelOk) {
        this.observability.recordFailure('VERSION_MISMATCH');
        return ok(
          refusedResponse({
            request,
            profile: this.profile,
            startedAt,
            completedAt,
            requestHash,
            errorCode: 'MODEL_IDENTITY_MISMATCH',
            errorDetail: 'gateway response model/deployment identity does not match qualified profile',
            safetyStatus: 'REFUSED',
          }),
        );
      }
    }

    const structuredCandidate = gw.response?.structured ?? parseReasoningFromText(gw.response?.text);
    const validatedOutput = structuredCandidate
      ? validateS3mFinanceReasoningResult(structuredCandidate)
      : null;

    const usageRecord = gw.usage;
    const usage = usageRecord
      ? buildS3mServingUsage({
          inputTokens: usageRecord.inputTokens,
          outputTokens: usageRecord.outputTokens,
          estimatedCostMicros: usageRecord.estimatedCostMicros,
          latencyMs,
        })
      : null;

    if (usage) {
      attributeS3mResearchUsage({
        inferenceRequestId: request.inferenceRequestId,
        workOrderRef: request.workOrderRef,
        taskRef: request.taskRef,
        providerId: 'S3M',
        modelId: this.profile.modelId,
        usage,
        recordedAt: completedAt,
      });
    }

    const responseHash = sha256Canonical(
      canonicalJson({
        inferenceRequestId: request.inferenceRequestId,
        structuredOutputValid: validatedOutput?.ok === true,
      }),
    );

    if (!validatedOutput?.ok) {
      this.observability.recordFailure('GENERAL');
      return ok(
        refusedResponse({
          request,
          profile: this.profile,
          startedAt,
          completedAt,
          requestHash,
          errorCode: 'MODEL_OUTPUT_INVALID',
          errorDetail: validatedOutput?.error.detail ?? 'structured output missing or invalid',
          safetyStatus: 'ERROR',
        }),
      );
    }

    this.observability.recordSuccess(latencyMs);
    return ok(
      Object.freeze({
        inferenceRequestId: request.inferenceRequestId,
        modelId: this.profile.modelId,
        deploymentId: this.profile.deploymentId,
        modelVersion: this.profile.modelVersion,
        servingVersion: this.profile.servingVersion,
        result: validatedOutput.value,
        structuredOutputValid: true,
        modelConfidence: inferConfidence(validatedOutput.value),
        usage,
        timing: Object.freeze({
          startedAt,
          completedAt,
          latencyMs,
        }),
        servingEvidence: buildServingEvidence({
          profile: this.profile,
          requestHash,
          responseHash,
        }),
        safetyStatus: 'ACCEPTED',
        degraded: false,
        errorCode: null,
        errorDetail: null,
        grantsExecutionAuthority: false,
        selfAuthorizes: false,
      }),
    );
  }
}

function mapPrivacyToGateway(
  classification: S3mFinanceServingRequest['privacyClassification'],
): AiGatewayRequest['privacyClass'] {
  switch (classification) {
    case 'PUBLIC_RESEARCH':
      return 'PUBLIC';
    case 'INTERNAL':
      return 'INTERNAL';
    case 'CUSTOMER_PRIVATE':
      return 'PERSONAL';
    case 'RESTRICTED_SENSITIVE':
      return 'FINANCIAL_SENSITIVE';
    default:
      return 'PUBLIC';
  }
}

function mapPurposeToTaskClass(purpose: S3mFinanceServingRequest['purpose']): AiGatewayRequest['taskClass'] {
  switch (purpose) {
    case 'PORTFOLIO_REASONING':
      return 'PORTFOLIO_REASONING';
    case 'GROWTH_PLANNING':
      return 'GROWTH_PLANNING';
    case 'MARKET_OPPORTUNITY_RESEARCH':
      return 'MARKET_OPPORTUNITY_RESEARCH';
    case 'FINANCIAL_EXPLANATION':
      return 'FINANCIAL_EXPLANATION';
    default:
      return 'GENERAL_ASSISTANT';
  }
}

function buildPrompt(
  request: S3mFinanceServingRequest,
  fields: readonly { readonly contextClass: string; readonly payload: Readonly<Record<string, unknown>> }[],
): string {
  const contextSummary = fields.map((f) => `${f.contextClass}:${JSON.stringify(f.payload)}`).join('; ');
  return `S3M_FINANCE ${request.purpose} task=${request.taskRef ?? 'none'} context=${contextSummary}`;
}

function parseReasoningFromText(text: string | null | undefined): unknown | null {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function inferConfidence(
  result: { readonly recommendedNextState: string; readonly missingInformation: readonly string[] },
): 'LOW' | 'MEDIUM' | 'HIGH' | null {
  if (result.missingInformation.length > 2) {
    return 'LOW';
  }
  if (result.recommendedNextState === 'WAIT' || result.recommendedNextState === 'INVESTIGATE') {
    return 'MEDIUM';
  }
  return 'HIGH';
}

function resolveFallback(
  request: S3mFinanceServingRequest,
  errorCode: string,
): S3mFallbackPolicy {
  if (s3mPrivacyRequiresPrivateQualification(request.privacyClassification)) {
    return request.fallbackPolicy === 'DEGRADE_TO_PUBLIC_RESEARCH' ? 'REQUIRE_REVIEW' : request.fallbackPolicy;
  }
  if (errorCode === 'MODEL_UNAVAILABLE' || errorCode === 'PROVIDER_UNAVAILABLE') {
    return request.fallbackPolicy;
  }
  return request.fallbackPolicy;
}
