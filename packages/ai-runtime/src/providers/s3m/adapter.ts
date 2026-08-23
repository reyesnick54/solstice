import type { Clock } from '../../../../config/src/clock.ts';
import type { SecretProvider } from '../../../../security/src/secrets.ts';
import { sha256Canonical } from '../../ids.ts';
import type { AiInferenceProvider } from '../../provider.ts';
import { streamEventsFromResponse, type AiStreamEvent } from '../../streaming.ts';
import { resolveProviderCredential } from '../../secrets.ts';
import type {
  AiProviderCapabilities,
  AiProviderFailure,
  AiProviderHealth,
  AiProviderMetadata,
  AiInferenceResponse,
  CanonicalProviderRequest,
} from '../../types.ts';
import type { Result } from '../../../../domain/src/result.ts';
import { ok } from '../../../../domain/src/result.ts';
import {
  resolveS3mProviderConfig,
  S3M_SUPPORTED_TASK_CLASSES,
  type S3mConfigInput,
  type S3mProviderConfig,
} from './configuration.ts';
import { classifyS3mTransportFailure, isRetryableS3mFailure, s3mFailure } from './errors.ts';
import { S3mCircuitBreaker } from './health.ts';
import { normalizeS3mResponse, S3M_PROVIDER_ID } from './normalization.ts';
import { firstProhibitedToolName, S3mSafetyLog } from './safety.ts';
import { SimulatedS3mServer } from './simulator.ts';
import type { S3mTransport } from './transport.ts';
import type { S3mCapabilityRecord, S3mSafetyEvent, S3mSimulatorFixture } from './types.ts';

export type S3mInferenceProviderOptions = {
  readonly clock: Clock;
  readonly available?: boolean;
  readonly config?: S3mConfigInput;
  readonly transport?: S3mTransport;
  readonly secrets?: SecretProvider | null;
};

function isClock(value: Clock | S3mInferenceProviderOptions): value is Clock {
  return typeof (value as Clock).now === 'function' && !('clock' in value);
}

/**
 * Canonical S3M inference adapter. Satisfies AiInferenceProvider.
 * S3M is the proprietary primary SunRey intelligence engine. It reasons
 * and may emit bounded tool intents. It cannot sign, approve, execute,
 * mint, change policy or mandates, hold master keys, or override Kernel,
 * risk, or jurisdiction decisions.
 */
export class S3mInferenceProvider implements AiInferenceProvider {
  private readonly clock: Clock;
  private readonly config: S3mProviderConfig;
  private readonly transport: S3mTransport | null;
  private readonly secrets: SecretProvider | null;
  private readonly available: boolean;
  private readonly circuit: S3mCircuitBreaker;
  private readonly safety: S3mSafetyLog;

  constructor(clockOrOptions: Clock | S3mInferenceProviderOptions, available = false) {
    if (isClock(clockOrOptions)) {
      this.clock = clockOrOptions;
      this.available = available;
      this.config = resolveS3mProviderConfig();
      this.transport = available ? new SimulatedS3mServer() : null;
      this.secrets = null;
    } else {
      this.clock = clockOrOptions.clock;
      this.available = clockOrOptions.available ?? true;
      this.config = resolveS3mProviderConfig(clockOrOptions.config ?? {});
      this.transport = clockOrOptions.transport ?? (this.available ? new SimulatedS3mServer() : null);
      this.secrets = clockOrOptions.secrets ?? null;
    }
    this.circuit = new S3mCircuitBreaker(
      this.clock,
      this.config.circuitFailureThreshold,
      this.config.circuitCooldownMs,
    );
    this.safety = new S3mSafetyLog(this.clock);
  }

  providerMetadata(): AiProviderMetadata {
    return Object.freeze({
      providerId: S3M_PROVIDER_ID,
      kind: 'S3M',
      label: 'S3M primary intelligence engine',
      credentialRef: this.config.credentialRef,
      implemented: this.transport !== null,
    });
  }

  capabilities(): AiProviderCapabilities {
    return Object.freeze({
      kind: 'S3M',
      supportsStructuredOutput: true,
      supportsToolIntents: true,
      supportsStreaming: true,
      supportsCancellation: false,
      externalNetwork: false,
      mayReceivePrivateKeys: false,
      mayExecuteFinancialActions: false,
      mayIssueExecutionAuthority: false,
    });
  }

  s3mCapabilities(): S3mCapabilityRecord {
    return Object.freeze({
      structuredOutput: true,
      toolIntentGeneration: true,
      streaming: false,
      health: true,
      contextSizeTokens: this.config.contextSizeTokens,
      supportedTaskClasses: S3M_SUPPORTED_TASK_CLASSES,
      modelId: this.config.modelId,
      modelVersion: this.config.modelVersion,
      maySign: false,
      mayApprove: false,
      mayExecute: false,
      mayMint: false,
      mayChangePolicy: false,
      mayChangeMandate: false,
      mayHoldMasterKeys: false,
      mayOverrideRisk: false,
      mayOverrideJurisdiction: false,
      mayOverrideKernel: false,
    });
  }

  health(): AiProviderHealth {
    if (!this.available || !this.transport) {
      return Object.freeze({
        providerId: S3M_PROVIDER_ID,
        kind: 'S3M',
        healthy: false,
        reason: 'S3M proprietary engine is not connected',
        checkedAt: this.clock.now(),
        networkEnabled: false,
      });
    }
    if (!this.circuit.allowRequest()) {
      return Object.freeze({
        providerId: S3M_PROVIDER_ID,
        kind: 'S3M',
        healthy: false,
        reason: 'S3M circuit breaker is open',
        checkedAt: this.clock.now(),
        networkEnabled: false,
      });
    }
    const probe = this.transport.health(this.clock.now(), this.config.endpoints);
    return Object.freeze({
      providerId: S3M_PROVIDER_ID,
      kind: 'S3M',
      healthy: probe.healthy,
      reason: probe.reason,
      checkedAt: probe.checkedAt,
      networkEnabled: false,
    });
  }

  safetyEvents(): readonly S3mSafetyEvent[] {
    return this.safety.snapshot();
  }

  stream(request: CanonicalProviderRequest): Result<readonly AiStreamEvent[], AiProviderFailure> {
    const inferred = this.infer(request);
    if (!inferred.ok) {
      return inferred;
    }
    return ok(streamEventsFromResponse(request.requestId, inferred.value));
  }

  infer(request: CanonicalProviderRequest): Result<AiInferenceResponse, AiProviderFailure> {
    const correlationId = sha256Canonical(`${request.requestId}:${request.promptHash}`).slice(0, 24);
    if (!this.available || !this.transport) {
      this.safety.emit('UNAVAILABLE', correlationId, 'S3M transport is not connected', 'PROVIDER_UNAVAILABLE');
      return s3mFailure('PROVIDER_UNAVAILABLE', 'S3M is the reserved primary engine and is not connected');
    }
    if (!this.circuit.allowRequest()) {
      this.safety.emit('CIRCUIT_OPEN', correlationId, 'S3M circuit breaker is open', 'PROVIDER_UNAVAILABLE');
      return s3mFailure('PROVIDER_UNAVAILABLE', 'S3M circuit breaker is open');
    }
    const credential = resolveProviderCredential(this.secrets, this.config.credentialRef);
    if (!credential.ok) {
      return credential;
    }

    const mappedFixture = request.fixture ? fixtureFromCanonical(request.fixture) : undefined;
    const nativeRequest = Object.freeze({
      correlationId,
      modelId: this.config.modelId,
      modelVersion: this.config.modelVersion,
      promptHash: request.promptHash,
      taskClass: request.taskClass,
      releasedContext: request.releasedContext.map((object) => object.payload),
      ...(mappedFixture ? { fixture: mappedFixture } : {}),
    } satisfies {
      readonly correlationId: string;
      readonly modelId: string;
      readonly modelVersion: string;
      readonly promptHash: string;
      readonly taskClass: CanonicalProviderRequest['taskClass'];
      readonly releasedContext: readonly Readonly<Record<string, unknown>>[];
      readonly fixture?: NonNullable<ReturnType<typeof fixtureFromCanonical>>;
    });

    const maxAttempts = Math.max(1, this.config.maxAttempts);
    let lastFailure: ReturnType<typeof classifyS3mTransportFailure> | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const transported = this.transport.infer(nativeRequest, this.config.endpoints);
      if (!transported.ok) {
        lastFailure = classifyS3mTransportFailure(transported);
        if (transported.code === 'TIMEOUT') {
          this.safety.emit('TIMEOUT', correlationId, transported.detail, 'PROVIDER_TIMEOUT');
        }
        if (transported.code === 'UNAVAILABLE') {
          this.safety.emit('UNAVAILABLE', correlationId, transported.detail, 'PROVIDER_UNAVAILABLE');
        }
        if (attempt < maxAttempts && isRetryableS3mFailure(transported)) {
          continue;
        }
        this.circuit.recordFailure();
        return s3mFailure(lastFailure.code, lastFailure.detail);
      }

      const prohibited = firstProhibitedToolName(transported.value.toolRequests);
      if (prohibited) {
        this.circuit.recordSuccess();
        this.safety.emit(
          'PROHIBITED_TOOL_REJECTED',
          correlationId,
          `S3M requested prohibited tool ${prohibited}`,
          'FORBIDDEN_TOOL_REQUESTED',
        );
        return s3mFailure('FORBIDDEN_TOOL_REQUESTED', `S3M requested prohibited tool ${prohibited}`);
      }

      const normalized = normalizeS3mResponse(request, transported.value);
      if (!normalized.ok) {
        this.circuit.recordSuccess();
        this.safety.emit(
          'MALFORMED_OUTPUT_REJECTED',
          correlationId,
          normalized.error.detail,
          normalized.error.code,
        );
        return normalized;
      }
      this.circuit.recordSuccess();
      return ok(normalized.value);
    }

    this.circuit.recordFailure();
    return s3mFailure(lastFailure?.code ?? 'PROVIDER_UNAVAILABLE', lastFailure?.detail ?? 'S3M inference failed closed');
  }
}

function fixtureFromCanonical(
  fixture: CanonicalProviderRequest['fixture'],
): S3mSimulatorFixture | undefined {
  switch (fixture) {
    case 'timeout':
      return 'timeout';
    case 'unavailable':
      return 'unavailable';
    case 'malformed':
      return 'malformed';
    case 'malicious_tool':
      return 'prohibited_tool';
    case 'structured_financial_proposal':
      return 'grow_my_money';
    case 'normal':
      return 'explanation';
    default:
      return undefined;
  }
}

/** Chunk 101 alias. Constructor `(clock, available)` remains supported. */
export class S3mAiProvider extends S3mInferenceProvider {}
