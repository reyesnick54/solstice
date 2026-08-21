/**
 * Public consumer-platform types. These match
 * api/sunrey-consumer-platform-v1.openapi.yaml.
 *
 * Browser-safe. No ledger, Kernel, or Execution Authority types.
 */

import type { CONSUMER_API_VERSION } from './errors.ts';

export const INTEGRATION_ENVIRONMENTS = [
  'LOCAL',
  'TEST',
  'SANDBOX',
  'STAGING',
  'PREPRODUCTION',
  'PRODUCTION',
] as const;
export type IntegrationEnvironment = (typeof INTEGRATION_ENVIRONMENTS)[number];

export const ACTION_STATES = [
  'ALLOW',
  'REQUIRE_MANUAL_REVIEW',
  'DEFER',
  'BLOCK',
  'FEATURE_UNAVAILABLE',
  'UNAUTHENTICATED',
] as const;
export type ActionState = (typeof ACTION_STATES)[number];

export const CONSUMER_FEATURE_IDS = [
  'home',
  'accounts',
  'activity',
  'capabilities',
  'approvals',
  'webhooks',
  'investments',
  'cards',
  'exchange_trading',
] as const;
export type ConsumerFeatureId = (typeof CONSUMER_FEATURE_IDS)[number];

export const CONSUMER_ACTION_TYPES = ['OPEN_ACCOUNT'] as const;
export type ConsumerActionType = (typeof CONSUMER_ACTION_TYPES)[number];

export const SANDBOX_PERSONA_IDS = [
  'alex-ready',
  'blair-restricted',
  'casey-capable',
  'drew-empty',
  'evan-paged',
] as const;
export type SandboxPersonaId = (typeof SANDBOX_PERSONA_IDS)[number];

export const DEVICE_TRUST_STATES = ['KNOWN', 'TRUSTED', 'REVIEW_REQUIRED', 'BLOCKED'] as const;
export type DeviceTrustState = (typeof DEVICE_TRUST_STATES)[number];

export type MoneyDto = {
  readonly minor_units: string;
  readonly currency: string;
};

export type PositionBreakdownDto = {
  readonly deposits: MoneyDto;
  readonly investments: MoneyDto;
  readonly digital_assets: MoneyDto;
  readonly rewards: MoneyDto;
  readonly pending: MoneyDto;
};

export type CustomerPositionDto = {
  readonly customer_id: string;
  readonly grand_total: MoneyDto;
  readonly breakdown: PositionBreakdownDto;
};

export type PageDto<T> = {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
  readonly page_size: number;
};

export type SessionDto = {
  readonly session_id: string;
  readonly actor_id: string;
  readonly identity_id: string;
  readonly expires_at: string;
  readonly device_id: string | null;
  readonly assurance: string;
  readonly revocation_state: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
};

export type TokenResponse = {
  readonly access_token: string;
  readonly token_type: 'Bearer';
  readonly expires_in: number;
  readonly session: SessionDto;
  readonly api_version: typeof CONSUMER_API_VERSION;
};

export type DeviceDto = {
  readonly device_id: string;
  readonly device_ref: string;
  readonly trust_state: DeviceTrustState;
  readonly last_seen_at: string;
};

export type MeDto = {
  readonly actor_id: string;
  readonly identity_id: string;
  readonly customer_id: string | null;
  readonly assurance: string;
  readonly jurisdiction: string | null;
};

export type FeatureFlagDto = {
  readonly feature_id: ConsumerFeatureId;
  readonly available: boolean;
  readonly reason_code: string | null;
};

export type CapabilityDto = {
  readonly capability: string;
  readonly granted: boolean;
};

export type BootstrapDto = {
  readonly api_version: typeof CONSUMER_API_VERSION;
  readonly integration_environment: IntegrationEnvironment;
  readonly environment: 'simulation';
  readonly production_ready: false;
  readonly production_active: false;
  readonly live_connectivity_enabled: false;
  readonly me: MeDto;
  readonly session: SessionDto;
  readonly capabilities: readonly CapabilityDto[];
  readonly features: readonly FeatureFlagDto[];
  readonly degraded: readonly string[];
};

export type HomeAttentionDto = {
  readonly kind: 'APPROVAL_REQUIRED' | 'SESSION_EXPIRING' | 'FEATURE_UNAVAILABLE' | 'NONE';
  readonly message: string;
  readonly reference_id: string | null;
};

export type HomeDto = {
  readonly greeting: string;
  readonly environment_banner: 'SIMULATION';
  readonly account_count: number;
  readonly position: CustomerPositionDto | null;
  readonly attention: readonly HomeAttentionDto[];
  readonly features: readonly FeatureFlagDto[];
};

export type AccountDto = {
  readonly account_id: string;
  readonly account_class: string;
  readonly status: string;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly opened_at: string;
  readonly balance: MoneyDto;
};

export type ActivityItemDto = {
  readonly event_id: string;
  readonly event_type: string;
  readonly occurred_at: string;
  readonly summary: string;
};

export type ActionDecisionDto = {
  readonly action_id: string;
  readonly action_type: ConsumerActionType;
  readonly state: ActionState;
  readonly evidence_record_id: string | null;
  readonly approval_id: string | null;
  readonly account_id: string | null;
  readonly message: string;
};

export type ApprovalDto = {
  readonly approval_id: string;
  readonly action_id: string;
  readonly state: 'REQUIRE_MANUAL_REVIEW' | 'DEFER';
  readonly created_at: string;
  readonly message: string;
};

export type JobDto = {
  readonly job_id: string;
  readonly kind: 'WEBHOOK_DELIVERY' | 'EVENT_DISPATCH';
  readonly status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  readonly created_at: string;
  readonly result_safe: string | null;
};

export type WebhookEndpointDto = {
  readonly endpoint_id: string;
  readonly url: string;
  readonly event_types: readonly string[];
  readonly created_at: string;
};

export type HealthDto = {
  readonly status: 'ok';
  readonly api_version: typeof CONSUMER_API_VERSION;
  readonly surface: 'CONSUMER_PLATFORM';
  readonly environment: 'simulation';
  readonly production_active: false;
};

export type VersionDto = {
  readonly api_version: typeof CONSUMER_API_VERSION;
  readonly product: 'SunRey consumer platform';
  readonly integration_environment: IntegrationEnvironment;
};

export type SandboxPersonaDto = {
  readonly persona_id: SandboxPersonaId;
  readonly label: string;
  readonly capabilities: readonly string[];
};

export type RegisterResponse = {
  readonly identity_id: string;
  readonly status: 'ACTIVE';
  readonly next_step: 'PASSKEY_REGISTER';
};

export type PasskeyChallengeDto = {
  readonly challenge_id: string;
  readonly challenge: string;
  readonly rp_id: string;
  readonly origin: string;
  readonly expires_at: string;
};
