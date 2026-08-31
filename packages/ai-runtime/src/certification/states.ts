/**
 * Canonical AI provider qualification stages (Wave 4 Prompt 12).
 * Authentication success alone does not imply production qualification.
 */
export const AI_QUALIFICATION_STAGES = [
  'API_CONFIGURED',
  'AUTHENTICATED',
  'MODEL_AVAILABLE',
  'INFERENCE_SUCCESSFUL',
  'STRUCTURED_OUTPUT_VALIDATED',
  'EVALUATION_PASSED',
  'PRODUCTION_QUALIFIED',
] as const;

export type AiQualificationStage = (typeof AI_QUALIFICATION_STAGES)[number];

export const AI_PROVIDER_FAILURE_CLASSIFICATIONS = [
  'MODEL_UNAVAILABLE',
  'MODEL_NOT_AVAILABLE',
  'BILLING_DISABLED',
  'INSUFFICIENT_QUOTA',
  'AUTHENTICATION_FAILURE',
  'MODEL_RATE_LIMITED',
  'MODEL_TIMEOUT',
  'MODEL_PROVIDER_ERROR',
  'MODEL_OUTPUT_INVALID',
  'EXTERNAL_NETWORK_DISABLED',
  'PROVIDER_UNAVAILABLE',
  'UNKNOWN',
] as const;

export type AiProviderFailureClassification = (typeof AI_PROVIDER_FAILURE_CLASSIFICATIONS)[number];

export type AiQualificationSnapshot = {
  readonly provider: 'XAI_GROK' | 'S3M' | 'LOCAL_TEST' | 'HTTPS_GENERIC';
  readonly model: string;
  readonly reachable: boolean;
  readonly authenticated: boolean;
  readonly modelAvailable: boolean;
  readonly inferenceSuccessful: boolean;
  readonly structuredOutputValid: boolean;
  readonly evaluationStatus: 'NOT_RUN' | 'PASSED' | 'FAILED' | 'BLOCKED';
  readonly currentStage: AiQualificationStage | 'NOT_CONFIGURED';
  readonly failureClassification: AiProviderFailureClassification | null;
  readonly latencyMs: number | null;
  readonly generatedAtUtc: string;
};

export function deriveQualificationStage(snapshot: Omit<AiQualificationSnapshot, 'currentStage'>): AiQualificationStage | 'NOT_CONFIGURED' {
  if (snapshot.inferenceSuccessful && snapshot.structuredOutputValid && !snapshot.authenticated) {
    return snapshot.evaluationStatus === 'PASSED' ? 'EVALUATION_PASSED' : 'STRUCTURED_OUTPUT_VALIDATED';
  }
  if (!snapshot.reachable && !snapshot.authenticated) {
    return 'NOT_CONFIGURED';
  }
  if (!snapshot.authenticated) {
    return 'API_CONFIGURED';
  }
  if (!snapshot.modelAvailable) {
    return 'AUTHENTICATED';
  }
  if (!snapshot.inferenceSuccessful) {
    return 'MODEL_AVAILABLE';
  }
  if (!snapshot.structuredOutputValid) {
    return 'INFERENCE_SUCCESSFUL';
  }
  if (snapshot.evaluationStatus !== 'PASSED') {
    return 'STRUCTURED_OUTPUT_VALIDATED';
  }
  return 'PRODUCTION_QUALIFIED';
}
