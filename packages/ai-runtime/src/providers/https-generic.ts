import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asAiProviderId } from '../ids.ts';
import type { AiInferenceProvider } from '../provider.ts';
import { streamEventsFromResponse, type AiStreamEvent } from '../streaming.ts';
import { parseStructuredOutput } from '../structured.ts';
import { FixtureHttpsTransport, type HttpsInferenceTransport } from '../transport.ts';
import type {
  AiInferenceResponse,
  AiProviderCapabilities,
  AiProviderFailure,
  AiProviderHealth,
  AiProviderMetadata,
  CanonicalProviderRequest,
} from '../types.ts';

const PROVIDER_ID = asAiProviderId('aip_https_generic');

export type HttpsGenericAiProviderOptions = {
  readonly clock: Clock;
  readonly transport?: HttpsInferenceTransport;
  readonly host?: string;
  readonly path?: string;
  readonly timeoutMs?: number;
};

/**
 * Vendor-neutral HTTPS inference adapter. Bind a host/path and transport;
 * do not import OpenAI, Anthropic, or Mistral SDKs into Agent code.
 */
export class HttpsGenericAiProvider implements AiInferenceProvider {
  private readonly clock: Clock;
  private readonly transport: HttpsInferenceTransport;
  private readonly host: string;
  private readonly path: string;
  private readonly timeoutMs: number;
  private readonly cancelled = new Set<string>();

  constructor(clockOrOptions: Clock | HttpsGenericAiProviderOptions) {
    if (typeof (clockOrOptions as Clock).now === 'function' && !('clock' in (clockOrOptions as object))) {
      this.clock = clockOrOptions as Clock;
      this.transport = new FixtureHttpsTransport();
      this.host = 'ai.sandbox.local';
      this.path = '/v1/infer';
      this.timeoutMs = 5_000;
    } else {
      const options = clockOrOptions as HttpsGenericAiProviderOptions;
      this.clock = options.clock;
      this.transport = options.transport ?? new FixtureHttpsTransport();
      this.host = options.host ?? 'ai.sandbox.local';
      this.path = options.path ?? '/v1/infer';
      this.timeoutMs = options.timeoutMs ?? 5_000;
    }
  }

  providerMetadata(): AiProviderMetadata {
    return Object.freeze({
      providerId: PROVIDER_ID,
      kind: 'HTTPS_GENERIC',
      label: 'Vendor-neutral HTTPS inference adapter',
      credentialRef: null,
      implemented: true,
    });
  }

  capabilities(): AiProviderCapabilities {
    return Object.freeze({
      kind: 'HTTPS_GENERIC',
      supportsStructuredOutput: true,
      supportsToolIntents: false,
      supportsStreaming: true,
      supportsCancellation: true,
      externalNetwork: true,
      mayReceivePrivateKeys: false,
      mayExecuteFinancialActions: false,
      mayIssueExecutionAuthority: false,
    });
  }

  health(): AiProviderHealth {
    return Object.freeze({
      providerId: PROVIDER_ID,
      kind: 'HTTPS_GENERIC',
      healthy: true,
      reason: null,
      checkedAt: this.clock.now(),
      networkEnabled: true,
      liveConnectivity: false,
    });
  }

  cancel(requestId: CanonicalProviderRequest['requestId']): boolean {
    this.cancelled.add(requestId);
    return true;
  }

  infer(request: CanonicalProviderRequest): Result<AiInferenceResponse, AiProviderFailure> {
    if (this.cancelled.has(request.requestId) || request.cancel?.cancelled) {
      return err({
        ok: false,
        code: 'MODEL_CANCELLED',
        detail: 'HTTPS inference was cancelled',
        providerKind: 'HTTPS_GENERIC',
      });
    }
    const transported = this.transport.exchange({
      scheme: 'HTTPS',
      host: this.host,
      path: this.path,
      method: 'POST',
      timeoutMs: this.timeoutMs,
      correlationId: request.correlationId ?? request.requestId,
      headers: Object.freeze({ 'x-request-id': request.requestId }),
      body: Object.freeze({
        promptHash: request.promptHash,
        taskClass: request.taskClass,
        purpose: request.purpose ?? null,
      }),
      credentialRef: null,
      ...(request.cancel ? { cancel: request.cancel } : {}),
    });
    if (!transported.ok) {
      return err({
        ok: false,
        code: transported.code,
        detail: transported.detail,
        providerKind: 'HTTPS_GENERIC',
      });
    }
    const structured = parseStructuredOutput(
      transported.body.structured ?? {
        kind: 'EXPLANATION',
        text: typeof transported.body.text === 'string' ? transported.body.text : 'HTTPS sandbox explanation',
        guaranteedReturn: false,
      },
    );
    if (!structured.ok) {
      return structured;
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: PROVIDER_ID,
        providerKind: 'HTTPS_GENERIC',
        modelRef: request.modelRef,
        text: structured.value.kind === 'EXPLANATION' ? structured.value.text : null,
        structured: structured.value,
        toolIntents: Object.freeze([]),
        usage: Object.freeze({
          promptTokens: 6,
          completionTokens: 10,
          totalTokens: 16,
          latencyMs: transported.latencyMs,
          estimatedCostMicros: '0',
        }),
        grantsExecutionAuthority: false,
      }),
    );
  }

  stream(request: CanonicalProviderRequest): Result<readonly AiStreamEvent[], AiProviderFailure> {
    const inferred = this.infer(request);
    if (!inferred.ok) {
      return inferred;
    }
    return ok(streamEventsFromResponse(request.requestId, inferred.value));
  }
}
