import type { Result } from '../../domain/src/result.ts';
import type { AiRequestId } from './ids.ts';
import type { AiStreamEvent } from './streaming.ts';
import type {
  AiProviderCapabilities,
  AiProviderFailure,
  AiProviderHealth,
  AiProviderMetadata,
  AiInferenceResponse,
  CanonicalProviderRequest,
} from './types.ts';

/**
 * Canonical inference contract. The rest of SunRey consumes only this
 * interface. Provider-specific request/response objects stay inside adapters.
 * Agent and frontend code must not import vendor SDKs.
 */
export type AiInferenceProvider = {
  infer(request: CanonicalProviderRequest): Result<AiInferenceResponse, AiProviderFailure>;
  stream?(request: CanonicalProviderRequest): Result<readonly AiStreamEvent[], AiProviderFailure>;
  health(): AiProviderHealth;
  capabilities(): AiProviderCapabilities;
  providerMetadata(): AiProviderMetadata;
  cancel?(requestId: AiRequestId): boolean;
};
