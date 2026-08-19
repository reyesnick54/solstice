import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { SecretReference } from '../../../../security/src/secrets.ts';
import type { AiFailureCode, AiTaskClass } from '../../taxonomy.ts';

/**
 * S3M-native DTOs stay inside the adapter. They never escape as a
 * public SunRey contract. The exact remote route schema is unknown in
 * this repository, so the envelope is a transport contract only.
 */
export type S3mCorrelationId = string;

export const S3M_SIMULATOR_FIXTURES = [
  'grow_my_money',
  'explanation',
  'malformed',
  'prohibited_tool',
  'timeout',
  'unavailable',
  'retry_then_ok',
] as const;
export type S3mSimulatorFixture = (typeof S3M_SIMULATOR_FIXTURES)[number];

export type S3mEndpointContract = {
  readonly inferencePath: string;
  readonly healthPath: string;
};

export type S3mNativeRequest = {
  readonly correlationId: S3mCorrelationId;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly promptHash: string;
  readonly taskClass: AiTaskClass;
  readonly releasedContext: readonly Readonly<Record<string, unknown>>[];
  readonly fixture?: S3mSimulatorFixture;
};

export type S3mNativeResponse = {
  readonly correlationId: S3mCorrelationId;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly text: string | null;
  readonly structured: unknown;
  readonly toolRequests: unknown;
  readonly usage: {
    readonly promptTokens: number | null;
    readonly completionTokens: number | null;
    readonly totalTokens: number | null;
  };
};

export type S3mTransportFailureCode =
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'UNHEALTHY'
  | 'MALFORMED'
  | 'REJECTED';

export type S3mTransportFailure = {
  readonly ok: false;
  readonly code: S3mTransportFailureCode;
  readonly detail: string;
  readonly correlationId: S3mCorrelationId;
  readonly retryable: boolean;
};

export type S3mTransportSuccess = {
  readonly ok: true;
  readonly value: S3mNativeResponse;
};

export type S3mTransportResult = S3mTransportSuccess | S3mTransportFailure;

export type S3mHealthProbe = {
  readonly healthy: boolean;
  readonly reason: string | null;
  readonly checkedAt: UtcInstant;
};

export type S3mSafetyEventKind =
  | 'PROHIBITED_TOOL_REJECTED'
  | 'MALFORMED_OUTPUT_REJECTED'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'CIRCUIT_OPEN';

export type S3mSafetyEvent = {
  readonly kind: S3mSafetyEventKind;
  readonly correlationId: S3mCorrelationId;
  readonly detail: string;
  readonly failureCode: AiFailureCode;
  readonly at: UtcInstant;
};

export type S3mCapabilityRecord = {
  readonly structuredOutput: true;
  readonly toolIntentGeneration: true;
  readonly streaming: false;
  readonly health: true;
  readonly contextSizeTokens: number | null;
  readonly supportedTaskClasses: readonly AiTaskClass[];
  readonly modelId: string;
  readonly modelVersion: string;
  readonly maySign: false;
  readonly mayApprove: false;
  readonly mayExecute: false;
  readonly mayMint: false;
  readonly mayChangePolicy: false;
  readonly mayChangeMandate: false;
  readonly mayHoldMasterKeys: false;
  readonly mayOverrideRisk: false;
  readonly mayOverrideJurisdiction: false;
  readonly mayOverrideKernel: false;
};

export type S3mCredentialBinding = {
  readonly credentialRef: SecretReference | null;
};
