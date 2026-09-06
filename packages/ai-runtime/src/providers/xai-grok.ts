import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { SecretProvider } from '../../../security/src/secrets.ts';
import { asAiProviderId } from '../ids.ts';
import type { AiInferenceProvider } from '../provider.ts';
import { resolveProviderCredential } from '../secrets.ts';
import { streamEventsFromResponse, type AiStreamEvent } from '../streaming.ts';
import { parseStructuredOutput } from '../structured.ts';
import type { HttpsInferenceTransport } from '../transport.ts';
import { FixtureHttpsTransport, NodeHttpsInferenceTransport, classifyHttpsStatus } from '../transport.ts';
import type {
  AiInferenceResponse,
  AiProviderCapabilities,
  AiProviderFailure,
  AiProviderHealth,
  AiProviderMetadata,
  CanonicalProviderRequest,
  AiStructuredOutput,
} from '../types.ts';
import {
  resolveXaiGrokProviderConfig,
  type XaiGrokConfigInput,
  type XaiGrokProviderConfig,
} from './xai-grok/configuration.ts';

export const XAI_GROK_PROVIDER_ID = asAiProviderId('aip_xai_grok');

export type XaiGrokAiProviderOptions = {
  readonly clock: Clock;
  readonly config?: XaiGrokConfigInput;
  readonly transport?: HttpsInferenceTransport;
  readonly secrets?: SecretProvider | null;
  readonly available?: boolean;
};

function isClock(value: Clock | XaiGrokAiProviderOptions): value is Clock {
  return typeof (value as Clock).now === 'function' && !('clock' in value);
}

/**
 * xAI/Grok Responses API adapter for SunRey's canonical inference plane.
 *
 * The provider remains proposal/advisory-only. This adapter cannot sign,
 * approve, execute financial state changes, mint, issue Execution Authority,
 * or receive private keys. Network I/O is injected through the existing HTTPS
 * transport port so CI and simulation never contact xAI directly.
 */
export class XaiGrokAiProvider implements AiInferenceProvider {
  private readonly clock: Clock;
  private readonly config: XaiGrokProviderConfig;
  private readonly transport: HttpsInferenceTransport;
  private readonly secrets: SecretProvider | null;
  private readonly available: boolean;
  private readonly cancelled = new Set<string>();

  constructor(clockOrOptions: Clock | XaiGrokAiProviderOptions) {
    if (isClock(clockOrOptions)) {
      this.clock = clockOrOptions;
      this.config = resolveXaiGrokProviderConfig();
      this.transport = new FixtureHttpsTransport();
      this.secrets = null;
      this.available = false;
    } else {
      this.clock = clockOrOptions.clock;
      this.config = resolveXaiGrokProviderConfig(clockOrOptions.config ?? {});
      this.secrets = clockOrOptions.secrets ?? null;
      this.available = clockOrOptions.available ?? true;
      this.transport = clockOrOptions.transport ??
        (this.config.externalPreviewEnabled && this.secrets
          ? new NodeHttpsInferenceTransport({ enabled: true, secrets: this.secrets })
          : new FixtureHttpsTransport());
    }
  }

  providerMetadata(): AiProviderMetadata {
    return Object.freeze({
      providerId: XAI_GROK_PROVIDER_ID,
      kind: 'XAI_GROK',
      label: 'xAI Grok Responses API adapter',
      credentialRef: this.config.credentialRef,
      implemented: true,
    });
  }

  capabilities(): AiProviderCapabilities {
    return Object.freeze({
      kind: 'XAI_GROK',
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
    const configured = this.config.baseUrl.length > 0 && this.config.responsesPath.length > 0 && this.config.model.length > 0;
    const credentialReady = this.config.credentialRef !== null;
    const healthy = this.available && configured && credentialReady;
    return Object.freeze({
      providerId: XAI_GROK_PROVIDER_ID,
      kind: 'XAI_GROK',
      healthy,
      reason: healthy
        ? null
        : !this.available
          ? 'Grok provider is not enabled for this runtime'
          : !configured
            ? 'Grok endpoint/model configuration is incomplete'
            : 'Grok credential secret reference is not configured',
      checkedAt: this.clock.now(),
      networkEnabled: this.available,
      liveConnectivity: this.transport.liveConnectivity,
      externalAiPreviewConnectivity: this.transport.liveConnectivity,
    });
  }

  cancel(requestId: CanonicalProviderRequest['requestId']): boolean {
    this.cancelled.add(requestId);
    return true;
  }

  stream(request: CanonicalProviderRequest): Result<readonly AiStreamEvent[], AiProviderFailure> {
    const inferred = this.infer(request);
    if (!inferred.ok) {
      return inferred;
    }
    return ok(streamEventsFromResponse(request.requestId, inferred.value));
  }

  infer(request: CanonicalProviderRequest): Result<AiInferenceResponse, AiProviderFailure> {
    if (!this.available) {
      return this.fail('PROVIDER_UNAVAILABLE', 'Grok provider is not enabled for this runtime');
    }
    if (this.cancelled.has(request.requestId) || request.cancel?.cancelled) {
      return this.fail('MODEL_CANCELLED', 'Grok request was cancelled before dispatch');
    }
    const credential = resolveProviderCredential(this.secrets, this.config.credentialRef);
    if (!credential.ok) {
      return Object.freeze({ ...credential, error: { ...credential.error, providerKind: 'XAI_GROK' as const } });
    }

    let endpoint: URL;
    try {
      endpoint = new URL(this.config.baseUrl);
    } catch {
      return this.fail('MODEL_PROVIDER_ERROR', 'Grok base URL is invalid');
    }
    if (endpoint.protocol !== 'https:') {
      return this.fail('MODEL_POLICY_BLOCKED', 'Grok provider requires HTTPS');
    }

    const body: Record<string, unknown> = {
      model: this.config.model,
      input: buildResponsesInput(request),
      prompt_cache_key: request.correlationId ?? request.requestId,
    };
    const maxOutputTokens = request.maxOutputTokens ?? this.config.maxOutputTokens;
    if (maxOutputTokens !== null && maxOutputTokens !== undefined) {
      body.max_output_tokens = maxOutputTokens;
    }
    if (this.config.reasoningEffort !== null) {
      body.reasoning = Object.freeze({ effort: this.config.reasoningEffort });
    }
    if (request.purpose === 'MARKET_OPPORTUNITY_RESEARCH') {
      const tools: { readonly type: string }[] = [];
      if (this.config.webSearchEnabled) tools.push({ type: 'web_search' });
      if (this.config.xSearchEnabled) tools.push({ type: 'x_search' });
      if (tools.length > 0) body.tools = Object.freeze(tools);
    }

    const transported = this.transport.exchange({
      scheme: 'HTTPS',
      host: endpoint.host,
      path: this.config.responsesPath,
      method: 'POST',
      timeoutMs: this.config.timeoutMs,
      correlationId: request.correlationId ?? request.requestId,
      headers: Object.freeze({
        'content-type': 'application/json',
        'x-request-id': request.requestId,
      }),
      body: Object.freeze(body),
      credentialRef: this.config.credentialRef,
      ...(request.cancel ? { cancel: request.cancel } : {}),
    });

    if (!transported.ok) {
      return err({ ...transported, ok: false, providerKind: 'XAI_GROK' });
    }
    const status = classifyHttpsStatus(transported.status, transported.body);
    if (!status.ok) {
      return err({
        ok: false,
        code: status.error.code,
        detail: status.error.detail,
        providerKind: 'XAI_GROK',
      });
    }

    const text = extractOutputText(transported.body);
    const structuredCandidate = transported.body.structured ?? parseJsonObject(text);
    const structured: Result<AiStructuredOutput, AiProviderFailure> = structuredCandidate
      ? parseStructuredOutput(structuredCandidate)
      : text
        ? parseStructuredOutput({ kind: 'EXPLANATION', text, guaranteedReturn: false })
        : err({
            ok: false,
            code: 'MODEL_OUTPUT_INVALID',
            detail: 'Grok response did not contain output text or structured output',
            providerKind: 'XAI_GROK',
          });
    if (!structured.ok) {
      return err({ ...structured.error, providerKind: 'XAI_GROK' });
    }

    const usage = extractUsage(transported.body, transported.latencyMs);
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: XAI_GROK_PROVIDER_ID,
        providerKind: 'XAI_GROK',
        modelRef: request.modelRef,
        text: structured.value.kind === 'EXPLANATION' ? structured.value.text : text,
        structured: structured.value,
        toolIntents: Object.freeze([]),
        usage,
        grantsExecutionAuthority: false,
      }),
    );
  }

  private fail(code: AiProviderFailure['code'], detail: string): Result<never, AiProviderFailure> {
    return err({ ok: false, code, detail, providerKind: 'XAI_GROK' });
  }
}

function buildResponsesInput(request: CanonicalProviderRequest): readonly Readonly<Record<string, unknown>>[] {
  const input: Readonly<Record<string, unknown>>[] = [];
  if (request.systemPolicy) {
    input.push(Object.freeze({ role: 'system', content: request.systemPolicy }));
  }
  for (const message of request.messages ?? []) {
    input.push(Object.freeze({ role: message.role, content: message.content }));
  }
  if (input.length === 0) {
    input.push(Object.freeze({
      role: 'user',
      content: `SunRey canonical prompt hash: ${request.promptHash}`,
    }));
  }
  if (request.releasedContext.length > 0) {
    input.push(Object.freeze({
      role: 'user',
      content: JSON.stringify({
        purpose: request.purpose ?? request.taskClass,
        context: request.releasedContext.map((item) => item.payload),
      }),
    }));
  }
  return Object.freeze(input);
}

function extractOutputText(body: Readonly<Record<string, unknown>>): string | null {
  if (typeof body.output_text === 'string' && body.output_text.length > 0) {
    return body.output_text;
  }
  if (!Array.isArray(body.output)) {
    return null;
  }
  const parts: string[] = [];
  for (const item of body.output) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const entry of content) {
      if (entry && typeof entry === 'object') {
        const text = (entry as Record<string, unknown>).text;
        if (typeof text === 'string') {
          parts.push(text);
        }
      }
    }
  }
  return parts.length > 0 ? parts.join('') : null;
}

function parseJsonObject(value: string | null): unknown | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function extractUsage(body: Readonly<Record<string, unknown>>, latencyMs: number) {
  const usage = body.usage && typeof body.usage === 'object' ? body.usage as Record<string, unknown> : {};
  const inputTokens = integerOrNull(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = integerOrNull(usage.output_tokens ?? usage.completion_tokens);
  const totalTokens = integerOrNull(usage.total_tokens) ??
    (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  return Object.freeze({
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens,
    latencyMs,
    estimatedCostMicros: null,
  });
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
