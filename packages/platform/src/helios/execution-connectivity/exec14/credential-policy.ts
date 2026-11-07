import type { Exec14CredentialEnvironment } from './taxonomy.ts';

export type Exec14CredentialBinding = Readonly<{
  readonly providerId: string;
  readonly credentialRef: string;
  readonly environment: Exec14CredentialEnvironment;
  readonly scopes: readonly string[];
  readonly rotatable: true;
  readonly plaintextCredentialPresent: false;
  readonly committedToRepository: false;
  readonly loggedInTelemetry: false;
}>;

export type Exec14CredentialPolicyResult = Readonly<{
  readonly allowed: boolean;
  readonly violations: readonly string[];
}>;

const FORBIDDEN_SECRET_PATTERNS = [/BEGIN (RSA |EC )?PRIVATE KEY/, /api[_-]?key\s*=\s*\S+/i, /password\s*=\s*\S+/i];

export function evaluateExec14CredentialBinding(binding: Exec14CredentialBinding): Exec14CredentialPolicyResult {
  const violations: string[] = [];

  if (binding.plaintextCredentialPresent !== false) {
    violations.push('plaintext credentials are forbidden');
  }
  if (binding.committedToRepository !== false) {
    violations.push('credentials must not be committed');
  }
  if (binding.loggedInTelemetry !== false) {
    violations.push('credentials must not be logged');
  }
  if (binding.rotatable !== true) {
    violations.push('credentials must be rotatable');
  }
  if (!binding.credentialRef.startsWith('secretref:')) {
    violations.push('credentialRef must be a secret reference, not a raw value');
  }
  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    if (pattern.test(binding.credentialRef)) {
      violations.push('credentialRef resembles a secret material');
    }
  }
  if (binding.scopes.length === 0) {
    violations.push('credential scopes must be minimally declared');
  }

  return Object.freeze({
    allowed: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

export function fixtureExec14CredentialBinding(providerId: string): Exec14CredentialBinding {
  return Object.freeze({
    providerId,
    credentialRef: `secretref:fixture/exec14/${providerId}`,
    environment: 'SANDBOX',
    scopes: Object.freeze(['orders:paper', 'status:read']),
    rotatable: true,
    plaintextCredentialPresent: false,
    committedToRepository: false,
    loggedInTelemetry: false,
  });
}
