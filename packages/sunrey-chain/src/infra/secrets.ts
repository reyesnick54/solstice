/**
 * Classified secret references. Business modules receive SecretReference
 * values from packages/security — never raw configuration-file secrets.
 * Validator consensus keys are not general service secrets.
 */

import {
  InMemorySecretProvider,
  parseSecretReference,
  secretRef,
  type SecretProvider,
  type SecretReference,
} from '../../../security/src/secrets.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import { CONSENSUS_KEY_CLASSES, infraErr, infraOk, SECRET_CLASSES, type ConsensusKeyClass, type InfraEnvironment, type InfraResult, type SecretClass, type WorkloadService } from './types.ts';

export type ClassifiedSecretBinding = {
  readonly secretId: string;
  readonly secretClass: SecretClass;
  readonly reference: SecretReference;
  readonly environment: InfraEnvironment;
  readonly allowedIdentities: readonly WorkloadService[];
  readonly fixture: boolean;
  readonly rotationGeneration: number;
};

export type SecretAccessRequest = {
  readonly identity: WorkloadService;
  readonly secretId: string;
  readonly environment: InfraEnvironment;
};

export const CONSENSUS_KEY_FORBIDDEN_AS_SERVICE_SECRET = Object.freeze([...CONSENSUS_KEY_CLASSES]);

export function isConsensusKeyClass(value: string): value is ConsensusKeyClass {
  return (CONSENSUS_KEY_CLASSES as readonly string[]).includes(value);
}

export function assertNotConsensusServiceSecret(secretClass: string): void {
  if (isConsensusKeyClass(secretClass)) {
    throw new TypeError(
      `validator consensus key class ${secretClass} cannot be registered as a general service secret`,
    );
  }
}

export function parseClassifiedSecretReference(href: string): InfraResult<SecretReference> {
  const parsed = parseSecretReference(href);
  if (!parsed.ok) {
    return infraErr(parsed.error.code, parsed.error.message);
  }
  return infraOk(parsed.value);
}

export function classifiedSecretRef(provider: string, path: string): SecretReference {
  return secretRef(provider, path);
}

export class ClassifiedSecretStore {
  readonly #bindings = new Map<string, ClassifiedSecretBinding>();
  readonly #provider: InMemorySecretProvider;

  constructor(providerId = 'local-infra') {
    this.#provider = new InMemorySecretProvider(providerId);
  }

  get provider(): SecretProvider {
    return this.#provider;
  }

  put(
    binding: Omit<ClassifiedSecretBinding, 'reference'> & { readonly path: string; readonly value: string },
  ): ClassifiedSecretBinding {
    assertNotConsensusServiceSecret(binding.secretClass);
    if (!(SECRET_CLASSES as readonly string[]).includes(binding.secretClass)) {
      throw new TypeError(`unknown secret class ${binding.secretClass}`);
    }
    const reference = classifiedSecretRef(this.#provider.providerId, binding.path);
    const stored: ClassifiedSecretBinding = Object.freeze({
      secretId: binding.secretId,
      secretClass: binding.secretClass,
      reference,
      environment: binding.environment,
      allowedIdentities: Object.freeze([...binding.allowedIdentities]),
      fixture: binding.fixture,
      rotationGeneration: binding.rotationGeneration,
    });
    this.#bindings.set(binding.secretId, stored);
    this.#provider.put(binding.path, binding.value);
    return stored;
  }

  binding(secretId: string): ClassifiedSecretBinding | undefined {
    return this.#bindings.get(secretId);
  }

  list(): readonly ClassifiedSecretBinding[] {
    return Object.freeze([...this.#bindings.values()]);
  }

  authorize(request: SecretAccessRequest): InfraResult<ClassifiedSecretBinding> {
    const binding = this.#bindings.get(request.secretId);
    if (!binding) {
      return infraErr('SECRET_UNRESOLVED', `secret '${request.secretId}' is not configured`);
    }
    if (binding.environment !== request.environment) {
      return infraErr(
        'ENVIRONMENT_MISMATCH',
        `secret '${request.secretId}' is bound to ${binding.environment}, not ${request.environment}`,
      );
    }
    if (!binding.allowedIdentities.includes(request.identity)) {
      return infraErr(
        'SECRET_ISOLATION',
        `identity '${request.identity}' cannot retrieve secret '${request.secretId}'`,
      );
    }
    return infraOk(binding);
  }

  retrieve(request: SecretAccessRequest): InfraResult<SecretValue> {
    const authorized = this.authorize(request);
    if (!authorized.ok) {
      return authorized;
    }
    return this.#provider.resolve(authorized.value.reference);
  }

  rotate(
    secretId: string,
    nextValue: string,
    environment: InfraEnvironment,
  ): InfraResult<ClassifiedSecretBinding> {
    const current = this.#bindings.get(secretId);
    if (!current) {
      return infraErr('SECRET_UNRESOLVED', `secret '${secretId}' is not configured`);
    }
    if (current.environment !== environment) {
      return infraErr(
        'ENVIRONMENT_MISMATCH',
        `cannot rotate '${secretId}' under ${environment}; bound to ${current.environment}`,
      );
    }
    this.#provider.put(current.reference.path, nextValue);
    const updated: ClassifiedSecretBinding = Object.freeze({
      ...current,
      rotationGeneration: current.rotationGeneration + 1,
    });
    this.#bindings.set(secretId, updated);
    return infraOk(updated);
  }

  rejectFixtureInProductionCandidate(secretId: string, environment: InfraEnvironment): InfraResult<true> {
    const binding = this.#bindings.get(secretId);
    if (!binding) {
      return infraErr('SECRET_UNRESOLVED', `secret '${secretId}' is not configured`);
    }
    if (environment === 'PRODUCTION_CANDIDATE' && binding.fixture) {
      return infraErr('FIXTURE_REJECTED', `local fixture secret '${secretId}' is rejected in PRODUCTION_CANDIDATE`);
    }
    if (environment === 'PRODUCTION_CANDIDATE' && binding.environment === 'TESTNET') {
      return infraErr('TESTNET_KEY_REJECTED', `testnet key reference '${secretId}' is rejected in PRODUCTION_CANDIDATE`);
    }
    if (environment === 'PRODUCTION_CANDIDATE' && binding.environment === 'LOCAL') {
      return infraErr('LOCAL_SECRET_REJECTED', `local secret '${secretId}' is rejected in PRODUCTION_CANDIDATE`);
    }
    return infraOk(true);
  }
}
