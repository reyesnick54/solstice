import { inspect, type InspectOptions } from 'node:util';

import type { SecretValue } from '../../redaction.ts';
import { newCorrelationId } from '../../random.ts';
import {
  type CredentialFailureCode,
  type CredentialPlaneResult,
  type ProviderCredentialError,
} from './types.ts';

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /authorization|bearer|api[_-]?key|client_secret|password|private[_-]?key|oauth|mtls|webhook[_-]?secret|session[_-]?token|secret|credential|token/i;

const SENSITIVE_VALUE =
  /(?:authorization\s*[:=]\s*)?bearer\s+[a-z0-9._\-]+|client_secret\s*[:=]\s*\S+|api[_-]?key\s*[:=]\s*\S+|-----begin [a-z ]*private key-----|secret:\/\/[a-z0-9-]+\/\S+/i;

export function hideSecretPath(href: string): string {
  if (href.startsWith('secret://')) {
    const rest = href.slice('secret://'.length);
    const slash = rest.indexOf('/');
    const provider = slash > 0 ? rest.slice(0, slash) : 'unknown';
    return `secret://${provider}/[REDACTED]`;
  }
  return REDACTED;
}

export function redactCredentialText(value: string, hideSecretPaths = true): string {
  let out = value.replace(SENSITIVE_VALUE, REDACTED);
  if (hideSecretPaths) {
    out = out.replace(/secret:\/\/[a-z0-9-]+\/[^\s"']+/gi, (match) => hideSecretPath(match));
  }
  return out;
}

export function redactCredentialLog(value: unknown, hideSecretPaths = true): unknown {
  if (typeof value === 'string') {
    return redactCredentialText(value, hideSecretPaths);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactCredentialLog(item, hideSecretPaths));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactCredentialLog(nested, hideSecretPaths);
    }
    return out;
  }
  return value;
}

export function credentialErr(
  code: CredentialFailureCode,
  reason: string,
  context: { readonly providerId?: string; readonly credentialId?: string } = {},
): CredentialPlaneResult<never> {
  const error: ProviderCredentialError = Object.freeze({
    name: 'ProviderCredentialError',
    code,
    reason: redactCredentialText(reason),
    correlationId: newCorrelationId(),
    providerId: context.providerId ?? null,
    credentialId: context.credentialId ?? null,
  });
  return Object.freeze({ ok: false, error });
}

export function credentialOk<T>(value: T): CredentialPlaneResult<T> {
  return Object.freeze({ ok: true, value });
}

export function safeCredentialErrorMessage(error: ProviderCredentialError): string {
  return `${error.name}:${error.code}:${error.correlationId}`;
}

export function assertNoSecretInText(value: string, secret: string | SecretValue): boolean {
  const plaintext = typeof secret === 'string' ? secret : secret.revealUtf8();
  return !value.includes(plaintext);
}

export class ProtectedHandleView {
  readonly kind = 'ProtectedSecretHandle' as const;

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](_depth: number, _opts: InspectOptions): string {
    return REDACTED;
  }
}
