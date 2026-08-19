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

const PROVIDER_ID = asAiProviderId('aip_s3m');

/**
 * S3M is the intended proprietary primary intelligence engine.
 * This chunk registers the adapter contract only. No external networking.
 */
export class S3mAiProvider implements AiInferenceProvider {
  private readonly clock: Clock;
  private readonly available: boolean;

  constructor(clock: Clock, available = false) {
    this.clock = clock;
    this.available = available;
  }

  providerMetadata(): AiProviderMetadata {
    return Object.freeze({
      providerId: PROVIDER_ID,
      kind: 'S3M',
      label: 'S3M primary intelligence engine (simulation adapter)',
      credentialRef: null,
      implemented: false,
    });
  }

  capabilities(): AiProviderCapabilities {
    return Object.freeze({
      kind: 'S3M',
      supportsStructuredOutput: true,
      supportsToolIntents: true,
      externalNetwork: false,
      mayReceivePrivateKeys: false,
      mayExecuteFinancialActions: false,
      mayIssueExecutionAuthority: false,
    });
  }

  health(): AiProviderHealth {
    return Object.freeze({
      providerId: PROVIDER_ID,
      kind: 'S3M',
      healthy: this.available,
      reason: this.available ? null : 'S3M proprietary engine is not connected in this chunk',
      checkedAt: this.clock.now(),
      networkEnabled: false,
    });
  }

  infer(_request: CanonicalProviderRequest): Result<AiInferenceResponse, AiProviderFailure> {
    return err({
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      detail: 'S3M is the reserved primary engine and is not networked in Chunk 101',
      providerKind: 'S3M',
    });
  }
}
