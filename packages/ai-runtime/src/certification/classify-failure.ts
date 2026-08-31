import type { AiFailureCode } from '../taxonomy.ts';
import type { AiProviderFailureClassification } from './states.ts';

/**
 * Classify provider failures into explicit categories. Do not collapse
 * billing, quota, auth, and model-availability into a generic unavailable.
 */
export function classifyAiProviderFailure(input: {
  readonly code: AiFailureCode;
  readonly detail: string;
  readonly httpStatus?: number | null;
  readonly providerBody?: Readonly<Record<string, unknown>> | null;
}): AiProviderFailureClassification {
  const detail = input.detail.toLowerCase();
  const bodyText = extractProviderErrorText(input.providerBody).toLowerCase();

  if (input.code === 'AUTHORIZATION_REQUIRED' || input.httpStatus === 401) {
    return 'AUTHENTICATION_FAILURE';
  }
  if (input.code === 'INSUFFICIENT_QUOTA') {
    return 'INSUFFICIENT_QUOTA';
  }
  if (
    input.code === 'BILLING_DISABLED' ||
    input.httpStatus === 402 ||
    bodyText.includes('billing') ||
    bodyText.includes('payment required') ||
    detail.includes('billing')
  ) {
    return 'BILLING_DISABLED';
  }
  if (
    input.code === 'MODEL_RATE_LIMITED' ||
    input.httpStatus === 429 ||
    bodyText.includes('quota') ||
    bodyText.includes('rate limit')
  ) {
    return input.httpStatus === 429 || input.code === 'MODEL_RATE_LIMITED'
      ? 'MODEL_RATE_LIMITED'
      : 'INSUFFICIENT_QUOTA';
  }
  if (input.code === 'MODEL_TIMEOUT' || input.httpStatus === 408 || input.httpStatus === 504) {
    return 'MODEL_TIMEOUT';
  }
  if (
    input.code === 'MODEL_NOT_AVAILABLE' ||
    bodyText.includes('model not found') ||
    bodyText.includes('model unavailable') ||
    bodyText.includes('does not exist') ||
    (input.httpStatus === 404 && bodyText.includes('model'))
  ) {
    return 'MODEL_NOT_AVAILABLE';
  }
  if (input.code === 'MODEL_UNAVAILABLE' || input.httpStatus === 503) {
    return 'MODEL_UNAVAILABLE';
  }
  if (input.code === 'EXTERNAL_NETWORK_DISABLED' || input.code === 'PROVIDER_UNAVAILABLE') {
    return input.code === 'EXTERNAL_NETWORK_DISABLED' ? 'EXTERNAL_NETWORK_DISABLED' : 'PROVIDER_UNAVAILABLE';
  }
  if (input.code === 'MODEL_OUTPUT_INVALID' || input.code === 'INVALID_STRUCTURED_OUTPUT') {
    return 'MODEL_OUTPUT_INVALID';
  }
  if (input.code === 'MODEL_PROVIDER_ERROR') {
    return 'MODEL_PROVIDER_ERROR';
  }
  return 'UNKNOWN';
}

function extractProviderErrorText(body: Readonly<Record<string, unknown>> | null | undefined): string {
  if (!body) {
    return '';
  }
  const parts: string[] = [];
  if (typeof body.error === 'string') {
    parts.push(body.error);
  }
  if (body.error && typeof body.error === 'object') {
    const error = body.error as Record<string, unknown>;
    if (typeof error.message === 'string') parts.push(error.message);
    if (typeof error.code === 'string') parts.push(error.code);
    if (typeof error.type === 'string') parts.push(error.type);
  }
  if (typeof body.message === 'string') {
    parts.push(body.message);
  }
  return parts.join(' ');
}
