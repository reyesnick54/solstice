import type { SecretReference } from '../../../../security/src/secrets.ts';
import { parseSecretReference } from '../../../../security/src/secrets.ts';

export const XAI_GROK_DEFAULT_BASE_URL = 'https:' + '//api.x.ai';
export const XAI_GROK_DEFAULT_RESPONSES_PATH = '/v1/responses';
export const XAI_GROK_DEFAULT_MODEL = 'grok-4.6';
export const XAI_GROK_DEFAULT_TIMEOUT_MS = 30_000;

export type XaiGrokProviderConfig = {
  readonly baseUrl: string;
  readonly responsesPath: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number | null;
  readonly credentialRef: SecretReference | null;
  readonly externalPreviewEnabled: boolean;
  readonly webSearchEnabled: boolean;
  readonly xSearchEnabled: boolean;
};

export type XaiGrokConfigInput = {
  readonly baseUrl?: string;
  readonly responsesPath?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly maxOutputTokens?: number | null;
  readonly credentialRef?: string | SecretReference | null;
  readonly env?: NodeJS.ProcessEnv;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    return fallback;
  }
  return Number(value);
}

function optionalPositiveInteger(value: string | undefined): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    return null;
  }
  return Number(value);
}

function resolveCredentialRef(
  input: XaiGrokConfigInput['credentialRef'],
  envValue: string | undefined,
): SecretReference | null {
  const raw = typeof input === 'string' ? input : input?.href ?? envValue;
  if (!raw) {
    return input && typeof input === 'object' ? input : null;
  }
  const parsed = parseSecretReference(raw);
  return parsed.ok ? parsed.value : null;
}

export function resolveXaiGrokProviderConfig(input: XaiGrokConfigInput = {}): XaiGrokProviderConfig {
  const env = input.env ?? {};
  return Object.freeze({
    baseUrl: input.baseUrl ?? env.XAI_BASE_URL ?? XAI_GROK_DEFAULT_BASE_URL,
    responsesPath: input.responsesPath ?? env.XAI_RESPONSES_PATH ?? XAI_GROK_DEFAULT_RESPONSES_PATH,
    model: input.model ?? env.XAI_MODEL ?? XAI_GROK_DEFAULT_MODEL,
    timeoutMs: input.timeoutMs ?? positiveInteger(env.XAI_TIMEOUT_MS, XAI_GROK_DEFAULT_TIMEOUT_MS),
    maxOutputTokens: input.maxOutputTokens ?? optionalPositiveInteger(env.XAI_MAX_OUTPUT_TOKENS),
    credentialRef: resolveCredentialRef(input.credentialRef, env.XAI_CREDENTIAL_REF),
    externalPreviewEnabled: env.SUNREY_EXTERNAL_AI_PREVIEW_ENABLED === 'true',
    webSearchEnabled: env.XAI_WEB_SEARCH_ENABLED === 'true',
    xSearchEnabled: env.XAI_X_SEARCH_ENABLED === 'true',
  });
}
