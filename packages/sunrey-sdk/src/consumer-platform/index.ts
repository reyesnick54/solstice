/**
 * Lovable-safe / browser-safe SunRey consumer platform SDK.
 *
 * This module must not import Node-only privileged code, Ledger, Kernel,
 * Execution Authority, database clients, or provider credentials.
 */

export {
  CONSUMER_API_VERSION,
  CONSUMER_ERROR_CATEGORIES,
  CONSUMER_ERROR_CODES,
  SunReyConsumerError,
  categoryForConsumerCode,
  consumerError,
  isConsumerErrorEnvelope,
  sanitizeConsumerDetails,
} from './errors.ts';
export type {
  ConsumerErrorCategory,
  ConsumerErrorCode,
  ConsumerErrorEnvelope,
} from './errors.ts';
export {
  ACTION_STATES,
  CONSUMER_ACTION_TYPES,
  CONSUMER_FEATURE_IDS,
  DEVICE_TRUST_STATES,
  INTEGRATION_ENVIRONMENTS,
  SANDBOX_PERSONA_IDS,
} from './types.ts';
export type {
  AccountBalanceBreakdownDto,
  AccountDto,
  ActionDecisionDto,
  ActionState,
  ActivityItemDto,
  ApprovalDto,
  BootstrapDto,
  CapabilityDto,
  ConsumerActionType,
  ConsumerFeatureId,
  CustomerPositionDto,
  DeviceDto,
  DeviceTrustState,
  FeatureFlagDto,
  HealthDto,
  HomeAttentionDto,
  HomeDto,
  IntegrationEnvironment,
  JobDto,
  MeDto,
  MoneyDto,
  PageDto,
  PasskeyChallengeDto,
  PositionBreakdownDto,
  RegisterResponse,
  SandboxPersonaDto,
  SandboxPersonaId,
  SessionDto,
  TokenResponse,
  VersionDto,
  WebhookEndpointDto,
} from './types.ts';
export {
  SunReyConsumerClient,
  asConsumerPage,
  consumerErrorCode,
  createMemoryTokenStore,
  createSunReyConsumerClient,
  isRetryableConsumerError,
} from './client.ts';
export type {
  ConsumerAuthProvider,
  ConsumerClientOptions,
  ConsumerPageHelper,
  ConsumerPageQuery,
  ConsumerRequestOptions,
} from './client.ts';
