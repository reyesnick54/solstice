import type { Clock } from '../../../config/src/clock.ts';
import { err, type Result } from '../../../domain/src/result.ts';
import { asAiProviderId } from '../ids.ts';
import type { AiInferenceProvider } from '../provider.ts';
import type {
  AiInferenceResponse,
  AiProviderCapabilities,
  AiProviderFailure,
  AiProviderHealth,
  AiProviderMetadata,
  CanonicalProviderRequest,
} from '../types.ts';

const PROVIDER_ID = asAiProviderId('aip_xai_grok');

/**
 * xAI/Grok is reserved for Chunk 103. This adapter refuses all networking.
 */
export class XaiGrokAiProvider implements AiInferenceProvider {
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  providerMetadata(): AiProviderMetadata {
    return Object.freeze({
      providerId: PROVIDER_ID,
      kind: 'XAI_GROK',
      label: 'xAI Grok reserved adapter (Chunk 103)',
      credentialRef: null,
      implemented: false,
    });
  }

  capabilities(): AiProviderCapabilities {
    return Object.freeze({
      kind: 'XAI_GROK',
      supportsStructuredOutput: false,
      supportsToolIntents: false,
      supportsStreaming: false,
      supportsCancellation: false,
      externalNetwork: false,
      mayReceivePrivateKeys: false,
      mayExecuteFinancialActions: false,
      mayIssueExecutionAuthority: false,
    });
  }

  health(): AiProviderHealth {
    return Object.freeze({
      providerId: PROVIDER_ID,
      kind: 'XAI_GROK',
      healthy: false,
      reason: 'Grok networking is disabled until Chunk 103',
      checkedAt: this.clock.now(),
      networkEnabled: false,
    });
  }

  infer(_request: CanonicalProviderRequest): Result<AiInferenceResponse, AiProviderFailure> {
    return err({
      ok: false,
      code: 'GROK_NOT_IMPLEMENTED',
      detail: 'Do not implement Grok in this chunk; external networking is disabled',
      providerKind: 'XAI_GROK',
    });
  }
}
