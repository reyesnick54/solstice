import type { SecretProvider, SecretReference } from '../../security/src/secrets.ts';
import { parseSecretReference } from '../../security/src/secrets.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { AiProviderFailure } from './types.ts';

const SECRET_PATTERNS = [
  /secret:\/\/[a-z0-9/-]+/gi,
  /sk-[a-zA-Z0-9]{8,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function redactSecrets(value: string): string {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

export function assertNoPlaintextCredential(
  value: unknown,
  label: string,
): Result<true, AiProviderFailure> {
  const blob = typeof value === 'string' ? value : JSON.stringify(value);
  if (
    /sk-[a-zA-Z0-9]{8,}/.test(blob) ||
    /BEGIN [A-Z ]*PRIVATE KEY/.test(blob) ||
    /"apiKey"\s*:\s*"[^"]+"/.test(blob)
  ) {
    return err({
      ok: false,
      code: 'SECRET_IN_PAYLOAD',
      detail: `${label} must not contain plaintext provider credentials`,
      providerKind: null,
    });
  }
  return ok(true);
}

export function resolveProviderCredential(
  secrets: SecretProvider | null,
  reference: SecretReference | null,
): Result<null, AiProviderFailure> {
  if (!reference) {
    return ok(null);
  }
  const parsed = parseSecretReference(reference.href);
  if (!parsed.ok) {
    return err({
      ok: false,
      code: 'SECRET_IN_PAYLOAD',
      detail: 'invalid secret reference; plaintext credentials are forbidden',
      providerKind: null,
    });
  }
  if (!secrets) {
    return err({
      ok: false,
      code: 'AUTHORIZATION_REQUIRED',
      detail: 'provider credentials must be resolved through SecretProvider',
      providerKind: null,
    });
  }
  const resolved = secrets.resolve(parsed.value);
  if (!resolved.ok) {
    return err({
      ok: false,
      code: 'AUTHORIZATION_REQUIRED',
      detail: 'secret reference could not be resolved; plaintext credentials are forbidden',
      providerKind: null,
    });
  }
  return ok(null);
}
