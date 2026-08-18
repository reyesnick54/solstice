/**
 * Chunk 91 — executable production provider runtime types.
 *
 * Extends Chunk 66/68/69/82/90 owners. An adapter that works is not
 * an approved provider. Technical connectivity is not contract,
 * license, legal, or commercial evidence. PRODUCTION_AUTHORIZED
 * requires configured external evidence and human authority.
 */

import type { ProviderDomain } from '../providers/types.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';
import type { NetworkZone } from '../infra/types.ts';

export const PROVIDER_RUNTIME_SCHEMA_VERSION = 1 as const;
export const PROVIDER_RUNTIME_TOOL_VERSION = 'sunrey-ops/provider-runtime/1' as const;
export const PUBLIC_TICKER_POLICY = 'NOT_ASSIGNED' as const;
export const CANONICAL_ASSET_IDS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export const CONSENSUS_HAS_NO_PROVIDER_EGRESS = true as const;
export const ADAPTER_SUCCESS_IS_NOT_APPROVAL = true as const;

export const PROVIDER_RUNTIME_MODES = [
  'LOCAL_SIMULATION',
  'SANDBOX',
  'INTEGRATION_TEST',
  'PRODUCTION_CANDIDATE_DISABLED',
  'PRODUCTION_AUTHORIZED',
] as const;
export type ProviderRuntimeMode = (typeof PROVIDER_RUNTIME_MODES)[number];

export const REPORTED_RUNTIME_MODES = [
  'LOCAL_SIMULATION',
  'SANDBOX',
  'EXTERNAL_INTEGRATION_TEST',
] as const;
export type ReportedRuntimeMode = (typeof REPORTED_RUNTIME_MODES)[number];

export const PROVIDER_CIRCUIT_STATES = [
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'AUTH_FAILED',
  'SCHEMA_INCOMPATIBLE',
  'RATE_LIMITED',
] as const;
export type ProviderCircuitState = (typeof PROVIDER_CIRCUIT_STATES)[number];

export const PQC_PROBE_STATES = [
  'CLASSICAL_SUPPORTED',
  'ML_DSA_SUPPORTED',
  'HYBRID_PATTERN_SUPPORTED',
  'HARDWARE_PQ_SUPPORTED',
  'UNKNOWN',
] as const;
export type PqcProbeState = (typeof PQC_PROBE_STATES)[number];

export const FINANCIAL_SUBMISSION_STATES = [
  'NOT_SUBMITTED',
  'SUBMITTED',
  'CONFIRMED',
  'SUBMISSION_UNKNOWN',
] as const;
export type FinancialSubmissionState = (typeof FINANCIAL_SUBMISSION_STATES)[number];

export const WORKLOAD_IDENTITIES = [
  'oracle_collector',
  'explorer',
  'rpc',
  'case_management',
  'kyc_worker',
  'screening_worker',
  'travel_rule_worker',
  'surveillance_worker',
  'custody_worker',
  'banking_worker',
  'infra_worker',
  'kms_worker',
  'hsm_worker',
  'validator_signer',
  'consensus_execution',
  'governance_kms',
] as const;
export type WorkloadIdentity = (typeof WORKLOAD_IDENTITIES)[number];

export const MOCK_SCENARIOS = [
  'healthy',
  'timeout',
  'auth_failure',
  'schema_change',
  'duplicate_callback',
  'outage',
  'partial_response',
  'rate_limit',
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export const EVIDENCE_KINDS = [
  'ENGINEERING_INTEGRATION',
  'CONTRACT',
  'LICENSE',
  'LEGAL_APPROVAL',
  'COMMERCIAL_APPROVAL',
] as const;
export type ProviderRuntimeEvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type ProviderRuntimeError = {
  readonly code: string;
  readonly message: string;
};

export type ProviderRuntimeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProviderRuntimeError };

export function runtimeOk<T>(value: T): ProviderRuntimeResult<T> {
  return Object.freeze({ ok: true, value });
}

export function runtimeErr(code: string, message: string): ProviderRuntimeResult<never> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) });
}

export type ProviderConnectionProfile = {
  readonly profileId: string;
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly mode: ProviderRuntimeMode;
  readonly endpoint: string | null;
  readonly region: string | null;
  readonly configurationHash: string;
  readonly credentialRef: SecretReference | null;
  readonly networkZone: NetworkZone;
  readonly egressApproved: boolean;
  readonly version: string;
  readonly secretValuePresent: false;
};

export type ProviderCredentialBinding = {
  readonly bindingId: string;
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly credentialRef: SecretReference;
  readonly workloadIdentity: WorkloadIdentity;
  readonly allowedDomains: readonly ProviderDomain[];
  readonly leastPrivilege: true;
  readonly rawCredentialPresent: false;
};

export type ProviderSession = {
  readonly sessionId: string;
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly environment: ProviderRuntimeMode;
  readonly credentialRef: SecretReference | null;
  readonly workloadIdentity: WorkloadIdentity;
  readonly capabilities: readonly string[];
  readonly configurationHash: string;
  readonly networkRestrictions: readonly string[];
  readonly networkZone: NetworkZone;
  readonly sessionMetadata: Readonly<Record<string, string>>;
  readonly rawCredentialPresent: false;
};

export type ProviderHealthSnapshot = {
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly state: ProviderCircuitState;
  readonly latencyMs: number | null;
  readonly checkedAtUtc: string;
  readonly detail: string;
  readonly secretValuePresent: false;
};

export type ProviderCapabilityProbe = {
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly capability: string;
  readonly supported: boolean;
  readonly inferred: false;
  readonly evidenceSource: string;
  readonly hardwareBound: boolean;
};

export type PqcCapabilityProbe = {
  readonly providerId: string;
  readonly classical: PqcProbeState | null;
  readonly mlDsa: PqcProbeState | null;
  readonly hybrid: PqcProbeState | null;
  readonly hardwarePq: PqcProbeState;
  readonly softwarePqCannotClaimHardware: true;
  readonly inferredHardware: false;
};

export type ProviderIntegrationTest = {
  readonly testId: string;
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly mode: ProviderRuntimeMode;
  readonly reportedMode: ReportedRuntimeMode;
  readonly passed: boolean;
  readonly cases: readonly string[];
  readonly engineeringOnly: true;
  readonly legallyApproved: false;
};

export type ProviderIntegrationEvidence = {
  readonly evidenceId: string;
  readonly providerId: string;
  readonly domain: ProviderDomain;
  readonly kind: 'ENGINEERING_INTEGRATION';
  readonly testId: string;
  readonly digest: string;
  readonly createdAtUtc: string;
  readonly contractEvidence: false;
  readonly licenseEvidence: false;
  readonly legalApproval: false;
  readonly commercialApproval: false;
  readonly secretValuePresent: false;
};

export type LiveRuntimeCapabilityStatus = {
  readonly domain: ProviderDomain;
  readonly providerId: string;
  readonly probed: boolean;
  readonly health: ProviderCircuitState;
  readonly mode: ProviderRuntimeMode;
  readonly engineeringConnected: boolean;
  readonly legallyApproved: false;
  readonly commerciallyApproved: false;
};

export type ProviderRuntimeReadinessReport = {
  readonly schemaVersion: typeof PROVIDER_RUNTIME_SCHEMA_VERSION;
  readonly toolVersion: typeof PROVIDER_RUNTIME_TOOL_VERSION;
  readonly generatedAtUtc: string;
  readonly mode: ProviderRuntimeMode;
  readonly reportedMode: ReportedRuntimeMode;
  readonly technicalConnectivity: boolean;
  readonly productionAuthorized: boolean;
  readonly humanAuthorityPresent: boolean;
  readonly externalEvidencePresent: boolean;
  readonly secretValuePresent: false;
  readonly lanes: {
    readonly technical: boolean;
    readonly security: boolean;
    readonly commercial: boolean;
    readonly legalRegulatory: boolean;
    readonly human: boolean;
  };
  readonly snapshots: readonly ProviderHealthSnapshot[];
  readonly reportDigest: string;
};

export type ProviderRuntimeMetrics = {
  readonly latencyMs: number;
  readonly availability: number;
  readonly errorCount: number;
  readonly authFailures: number;
  readonly rateLimits: number;
  readonly schemaFailures: number;
  readonly retries: number;
  readonly callbackReplayRejections: number;
  readonly sensitivePayloadLogged: false;
};

export type ProviderWebhookEnvelope = {
  readonly providerId: string;
  readonly providerIdentity: string;
  readonly timestampUtc: string;
  readonly nonce: string;
  readonly reference: string;
  readonly signature: string | null;
  readonly schemaVersion: number;
  readonly payloadDigest: string;
};

export function isProviderRuntimeMode(value: string): value is ProviderRuntimeMode {
  return (PROVIDER_RUNTIME_MODES as readonly string[]).includes(value);
}

export function isWorkloadIdentity(value: string): value is WorkloadIdentity {
  return (WORKLOAD_IDENTITIES as readonly string[]).includes(value);
}
