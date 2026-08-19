import type { SecretReference } from '../../../../security/src/secrets.ts';
import { parseSecretReference } from '../../../../security/src/secrets.ts';
import { CANONICAL_S3M_MODEL_ID, CANONICAL_S3M_MODEL_VERSION } from '../../registry.ts';
import { AI_TASK_CLASSES, type AiTaskClass } from '../../taxonomy.ts';
import type { S3mEndpointContract } from './types.ts';

export const S3M_DEFAULT_TIMEOUT_MS = 5_000;
export const S3M_DEFAULT_MAX_ATTEMPTS = 2;
export const S3M_DEFAULT_CIRCUIT_FAILURES = 3;
export const S3M_DEFAULT_CIRCUIT_COOLDOWN_MS = 30_000;

export const S3M_SUPPORTED_TASK_CLASSES: readonly AiTaskClass[] = Object.freeze([
  ...AI_TASK_CLASSES,
]);

export type S3mProviderConfig = {
  readonly baseUrl: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly circuitFailureThreshold: number;
  readonly circuitCooldownMs: number;
  readonly contextSizeTokens: number | null;
  readonly endpoints: S3mEndpointContract;
  readonly credentialRef: SecretReference | null;
};

export type S3mConfigInput = {
  readonly baseUrl?: string;
  readonly modelId?: string;
  readonly modelVersion?: string;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly circuitFailureThreshold?: number;
  readonly circuitCooldownMs?: number;
  readonly contextSizeTokens?: number | null;
  readonly inferencePath?: string;
  readonly healthPath?: string;
  readonly credentialRef?: string | SecretReference | null;
  readonly env?: NodeJS.ProcessEnv;
};

function integerEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.length === 0) {
    return fallback;
  }
  if (!/^[0-9]+$/.test(value)) {
    return fallback;
  }
  return Number(value);
}

function optionalInteger(value: string | undefined): number | null {
  if (value === undefined || value.length === 0 || !/^[0-9]+$/.test(value)) {
    return null;
  }
  return Number(value);
}

function resolveCredentialRef(
  input: S3mConfigInput['credentialRef'],
  envValue: string | undefined,
): SecretReference | null {
  const raw = typeof input === 'string' ? input : input?.href ?? envValue;
  if (!raw) {
    return input && typeof input === 'object' ? input : null;
  }
  const parsed = parseSecretReference(raw);
  return parsed.ok ? parsed.value : null;
}

/**
 * Build S3M configuration from explicit input and optional process env.
 * Endpoint paths are opaque configured tokens. This chunk does not invent
 * a remote S3M HTTP route schema.
 */
export function resolveS3mProviderConfig(input: S3mConfigInput = {}): S3mProviderConfig {
  const env = input.env ?? {};
  return Object.freeze({
    baseUrl: input.baseUrl ?? env.S3M_BASE_URL ?? '',
    modelId: input.modelId ?? env.S3M_MODEL_ID ?? CANONICAL_S3M_MODEL_ID,
    modelVersion: input.modelVersion ?? env.S3M_MODEL_VERSION ?? CANONICAL_S3M_MODEL_VERSION,
    timeoutMs: input.timeoutMs ?? integerEnv(env.S3M_TIMEOUT_MS, S3M_DEFAULT_TIMEOUT_MS),
    maxAttempts: input.maxAttempts ?? integerEnv(env.S3M_MAX_ATTEMPTS, S3M_DEFAULT_MAX_ATTEMPTS),
    circuitFailureThreshold:
      input.circuitFailureThreshold ?? integerEnv(env.S3M_CIRCUIT_FAILURES, S3M_DEFAULT_CIRCUIT_FAILURES),
    circuitCooldownMs:
      input.circuitCooldownMs ?? integerEnv(env.S3M_CIRCUIT_COOLDOWN_MS, S3M_DEFAULT_CIRCUIT_COOLDOWN_MS),
    contextSizeTokens: input.contextSizeTokens ?? optionalInteger(env.S3M_CONTEXT_WINDOW_TOKENS),
    endpoints: Object.freeze({
      inferencePath: input.inferencePath ?? env.S3M_INFERENCE_PATH ?? '',
      healthPath: input.healthPath ?? env.S3M_HEALTH_PATH ?? '',
    }),
    credentialRef: resolveCredentialRef(input.credentialRef, env.S3M_CREDENTIAL_REF),
  });
}
