import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type ModelId = Brand<string, 'ModelId'>;
export type ModelVersion = Brand<string, 'ModelVersion'>;
export type ModelArtifactReference = Brand<string, 'ModelArtifactReference'>;
export type ModelValidationId = Brand<string, 'ModelValidationId'>;

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function asModelId(value: string): ModelId {
  return asPrefixed(value, 'mdl_', 'ModelId');
}

export function asModelVersion(value: string): ModelVersion {
  if (value.length === 0 || value.includes(' ')) {
    throw new TypeError('ModelVersion must be a non-empty token');
  }
  return brandAs<string, 'ModelVersion'>(value);
}

export function asModelArtifactReference(value: string): ModelArtifactReference {
  return asPrefixed(value, 'mar_', 'ModelArtifactReference');
}

export function asModelValidationId(value: string): ModelValidationId {
  return asPrefixed(value, 'mvn_', 'ModelValidationId');
}
