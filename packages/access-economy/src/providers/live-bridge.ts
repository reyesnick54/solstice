/**
 * Thin bridge to external-data Access Live Provider Fabric.
 * HTTP and provider URLs live in packages/external-data/src/access-live.
 */

export {
  createAccessLiveProviderFabricService,
  createLiveProviderCapabilityRegistry,
  AccessLiveProviderFabricService,
  LiveProviderCapabilityRegistry,
  PARTNER_GATED_PROVIDER_STATUS,
  type AccessHomeFeed,
  type AccessLiveOffer,
  type AccessOfferProvenance,
  type LiveAccessProviderId,
  type LiveProviderHealth,
  type LiveProviderRegistration,
  type LiveProviderSearchRequest,
  type LiveProviderSearchResult,
} from '../../../external-data/src/access-live/index.ts';
