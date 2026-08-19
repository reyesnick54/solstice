import type { Result } from '../../domain/src/result.ts';
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
 */
export type AiInferenceProvider = {
  infer(request: CanonicalProviderRequest): Result<AiInferenceResponse, AiProviderFailure>;
  health(): AiProviderHealth;
  capabilities(): AiProviderCapabilities;
  providerMetadata(): AiProviderMetadata;
};
