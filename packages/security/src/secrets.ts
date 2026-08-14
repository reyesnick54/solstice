import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import { SecretValue } from './redaction.ts';

/**
 * Application configuration holds references, not plaintext secrets.
 * Example: secret://simulation/execution-authority-signing
 */
export const SECRET_REFERENCE_SCHEME = 'secret';

export type SecretReference = {
  readonly scheme: typeof SECRET_REFERENCE_SCHEME;
  readonly provider: string;
  readonly path: string;
  readonly href: string;
};

export function parseSecretReference(value: string): SecurityResult<SecretReference> {
  if (!value.startsWith('secret://')) {
    return securityErr('INVALID_SECRET_REFERENCE', 'secret reference must start with secret://');
  }
  const rest = value.slice('secret://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) {
    return securityErr(
      'INVALID_SECRET_REFERENCE',
      'secret reference must be secret://<provider>/<path>',
    );
  }
  const provider = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  if (!/^[a-z][a-z0-9-]*$/.test(provider) || path.length === 0) {
    return securityErr('INVALID_SECRET_REFERENCE', 'secret reference provider or path is invalid');
  }
  return securityOk(
    Object.freeze({
      scheme: SECRET_REFERENCE_SCHEME,
      provider,
      path,
      href: value,
    }),
  );
}

export function secretRef(provider: string, path: string): SecretReference {
  const href = `secret://${provider}/${path}`;
  const parsed = parseSecretReference(href);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.value;
}

export type SecretProvider = {
  readonly providerId: string;
  resolve(reference: SecretReference): SecurityResult<SecretValue>;
};

export class InMemorySecretProvider implements SecretProvider {
  readonly providerId: string;
  readonly #values = new Map<string, SecretValue>();

  constructor(providerId: string, initial: Readonly<Record<string, string>> = {}) {
    this.providerId = providerId;
    for (const [path, value] of Object.entries(initial)) {
      this.#values.set(path, new SecretValue(value));
    }
    Object.freeze(this);
  }

  put(path: string, value: string | SecretValue): void {
    this.#values.set(path, value instanceof SecretValue ? value : new SecretValue(value));
  }

  resolve(reference: SecretReference): SecurityResult<SecretValue> {
    if (reference.provider !== this.providerId) {
      return securityErr(
        'SECRET_UNRESOLVED',
        `secret provider '${this.providerId}' cannot resolve '${reference.href}'`,
      );
    }
    const found = this.#values.get(reference.path);
    if (!found) {
      return securityErr('SECRET_UNRESOLVED', `secret '${reference.href}' is not configured`);
    }
    return securityOk(found);
  }
}

export class CompositeSecretProvider implements SecretProvider {
  readonly providerId = 'composite';
  readonly #providers: readonly SecretProvider[];

  constructor(providers: readonly SecretProvider[]) {
    this.#providers = providers;
  }

  resolve(reference: SecretReference): SecurityResult<SecretValue> {
    const match = this.#providers.find((provider) => provider.providerId === reference.provider);
    if (!match) {
      return securityErr(
        'SECRET_UNRESOLVED',
        `no secret provider registered for '${reference.provider}'`,
      );
    }
    return match.resolve(reference);
  }
}
