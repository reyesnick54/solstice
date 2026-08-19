import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { asAiProviderId } from '../../ids.ts';
import { parseStructuredOutput, parseToolIntents, structuredProposalToToolIntent } from '../../structured.ts';
import type {
  AiInferenceResponse,
  AiProviderFailure,
  CanonicalProviderRequest,
} from '../../types.ts';
import { remapStructuredFailure } from './errors.ts';
import type { S3mNativeResponse } from './types.ts';

export const S3M_PROVIDER_ID = asAiProviderId('aip_s3m');

function validationRequest(request: CanonicalProviderRequest) {
  return {
    requestId: request.requestId,
    taskClass: request.taskClass,
    mode: 'S3M_PRIMARY' as const,
    modelRef: request.modelRef,
    dataClass: 'SYNTHETIC' as const,
    jurisdictionRef: 'SIM',
    authorization: {
      actorId: 's3m',
      subjectId: 's3m',
      userApprovedExternal: false,
      mandateId: null,
      agentId: null,
    },
    prompt: '',
    context: [],
  };
}

/**
 * Convert an S3M-native envelope into canonical AiInferenceResponse.
 * S3M-specific DTOs do not leave this boundary.
 */
export function normalizeS3mResponse(
  request: CanonicalProviderRequest,
  native: S3mNativeResponse,
): Result<AiInferenceResponse, AiProviderFailure> {
  const structured = parseStructuredOutput(native.structured);
  if (!structured.ok) {
    return err(remapStructuredFailure(structured.error));
  }
  const tools = parseToolIntents(validationRequest(request), native.toolRequests);
  if (!tools.ok) {
    return err(remapStructuredFailure(tools.error));
  }
  const intents =
    structured.value.kind === 'FINANCIAL_PROPOSAL'
      ? Object.freeze([structuredProposalToToolIntent(validationRequest(request), structured.value)])
      : tools.value;
  return ok(
    Object.freeze({
      requestId: request.requestId,
      providerId: S3M_PROVIDER_ID,
      providerKind: 'S3M',
      modelRef: request.modelRef,
      text: native.text,
      structured: structured.value,
      toolIntents: intents,
      usage: Object.freeze({
        promptTokens: native.usage.promptTokens,
        completionTokens: native.usage.completionTokens,
        totalTokens: native.usage.totalTokens,
      }),
      grantsExecutionAuthority: false,
    }),
  );
}
