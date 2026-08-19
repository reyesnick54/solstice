import { err, ok, type Result } from '../../domain/src/result.ts';
import { isUtcInstant } from '../../domain/src/time.ts';
import { ASSET_ID_PREFIXES } from './ids.ts';
import {
  ASSET_LIFECYCLE_STATES,
  DEFAULT_CLASS_POLICY,
  FORBIDDEN_IDENTITY_FIELDS,
  FORBIDDEN_SCORE_FIELDS,
  FORBIDDEN_SOURCE_CLASSES,
  NATIVE_MONETARY_ASSET_CLASSES,
  PROTECTED_CONTENT_SENSITIVITY,
  defaultStorageForSensitivity,
  isEconomicAssetClass,
  isEconomicCategory,
  isNativeMonetaryAssetClass,
  isSourceClass,
  storageAllowsPublicOnChainMetadata,
} from './taxonomy.ts';
import type { RegisterAssetInput, RegistryFailure } from './types.ts';

const JURISDICTION_RE = /^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const RAW_HINT_RE = /\b(raw[-_ ]?(dataset|content|telemetry|pdv|scada|mes)|ssn|passport|legalName|fullName)\b/i;

const FORBIDDEN_KEY_SET = new Set<string>([...FORBIDDEN_IDENTITY_FIELDS, ...FORBIDDEN_SCORE_FIELDS]);

function failure(code: RegistryFailure['code'], message: string): RegistryFailure {
  return Object.freeze({ code, message });
}

function isCanonicalReference(text: string): boolean {
  return Object.values(ASSET_ID_PREFIXES).some((prefix) => text.startsWith(prefix));
}

function walkKeysAndStrings(value: unknown, keys: string[], strings: string[]): void {
  if (typeof value === 'string') {
    strings.push(value);
    return;
  }
  if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkKeysAndStrings(item, keys, strings);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      walkKeysAndStrings(item, keys, strings);
    }
  }
}

export function scanForbiddenPayload(input: unknown): Result<true, RegistryFailure> {
  const keys: string[] = [];
  const strings: string[] = [];
  walkKeysAndStrings(input, keys, strings);

  for (const key of keys) {
    if (FORBIDDEN_KEY_SET.has(key) || FORBIDDEN_KEY_SET.has(key.toLowerCase())) {
      if ((FORBIDDEN_SCORE_FIELDS as readonly string[]).includes(key) || (FORBIDDEN_SCORE_FIELDS as readonly string[]).includes(key.toLowerCase())) {
        return err(failure('AUTOMATIC_VALUATION_FORBIDDEN', `valuation or mint field '${key}' is forbidden on an economic asset descriptor`));
      }
      if (key === 'rawDataset' || key === 'rawContent' || key === 'rawTelemetry' || key === 'blob' || key === 'payload') {
        return err(failure('BLOB_STORE_FORBIDDEN', 'the registry is not a blob store and cannot hold raw datasets'));
      }
      return err(failure('RAW_SENSITIVE_DATA_FORBIDDEN', `identity or raw-content field '${key}' cannot appear on registry metadata`));
    }
  }

  for (const text of strings) {
    if (isCanonicalReference(text)) {
      continue;
    }
    if (EMAIL_RE.test(text) || PHONE_RE.test(text) || SSN_RE.test(text) || RAW_HINT_RE.test(text)) {
      return err(failure('RAW_SENSITIVE_DATA_FORBIDDEN', 'registry metadata must not leak protected content'));
    }
  }
  return ok(true);
}

export function validateRegisterInput(input: RegisterAssetInput): Result<true, RegistryFailure> {
  const scanned = scanForbiddenPayload(input);
  if (!scanned.ok) {
    return scanned;
  }
  if (isNativeMonetaryAssetClass(input.assetClass as string) || (NATIVE_MONETARY_ASSET_CLASSES as readonly string[]).includes(input.assetClass)) {
    return err(failure('NATIVE_MONETARY_ASSET_FORBIDDEN', 'SunRey and MoonRey native supply remain outside this registry'));
  }
  if (!isEconomicAssetClass(input.assetClass)) {
    return err(failure('INVALID_ASSET_CLASS', `unknown asset class ${input.assetClass}`));
  }
  if (!isSourceClass(input.sourceClass) || (FORBIDDEN_SOURCE_CLASSES as readonly string[]).includes(input.sourceClass)) {
    return err(failure('INVALID_SOURCE_CLASS', `source class ${input.sourceClass} is not a governed dataset source`));
  }
  if (!isEconomicCategory(input.economicCategory)) {
    return err(failure('INVALID_ASSET_CLASS', `unknown economic category ${input.economicCategory}`));
  }
  if (!JURISDICTION_RE.test(input.jurisdiction)) {
    return err(failure('INVALID_JURISDICTION', 'jurisdiction must be an ISO-like coded reference'));
  }
  if (!isUtcInstant(input.validFrom) || !isUtcInstant(input.createdAt)) {
    return err(failure('INVALID_TIMESTAMP', 'validFrom and createdAt must be UTC instants'));
  }
  if (input.validUntil && !isUtcInstant(input.validUntil)) {
    return err(failure('INVALID_TIMESTAMP', 'validUntil must be a UTC instant'));
  }
  if (input.status && !(ASSET_LIFECYCLE_STATES as readonly string[]).includes(input.status)) {
    return err(failure('INVALID_LIFECYCLE', `unknown lifecycle state ${input.status}`));
  }
  if (input.status === 'VERIFIED' && input.qualityClass === 'INFERRED') {
    return err(failure('INVALID_LIFECYCLE', 'INFERRED quality cannot be registered as VERIFIED'));
  }
  const storage = input.storageClass ?? defaultStorageForSensitivity(input.sensitivityClass);
  if (
    (PROTECTED_CONTENT_SENSITIVITY as readonly string[]).includes(input.sensitivityClass) &&
    storage === 'ON_CHAIN_PUBLIC_METADATA'
  ) {
    return err(
      failure('PROTECTED_CONTENT_ON_CHAIN_FORBIDDEN', 'protected personal or secret-reference content cannot be public on-chain metadata'),
    );
  }
  if (!storageAllowsPublicOnChainMetadata(input.sensitivityClass) && storage === 'ON_CHAIN_PUBLIC_METADATA' && input.sensitivityClass === 'SENSITIVE_PERSONAL') {
    return err(failure('PROTECTED_CONTENT_ON_CHAIN_FORBIDDEN', 'sensitive personal data stays OFF_CHAIN_PROTECTED'));
  }
  if (input.contentCommitmentMaterial.length === 0 || input.provenanceMaterial.length === 0) {
    return err(failure('BLOB_STORE_FORBIDDEN', 'register commitments and provenance digests, not raw datasets'));
  }
  if (input.contentCommitmentMaterial.length > 256 || input.provenanceMaterial.length > 256) {
    return err(failure('BLOB_STORE_FORBIDDEN', 'commitment material must be a short digest seed, not dataset content'));
  }
  return ok(true);
}

export function refuseNativeMonetaryAsset(assetClass: string): RegistryFailure {
  return failure(
    'NATIVE_MONETARY_ASSET_FORBIDDEN',
    `${assetClass} is a native monetary supply record and cannot be registered as a dataset or economic evidence asset`,
  );
}

export function registryDoesNotMint(): {
  readonly automaticValuation: false;
  readonly automaticSunReyMint: false;
  readonly automaticMoonReyMint: false;
  readonly settlementAuthorizedByRegistration: false;
} {
  return Object.freeze({
    automaticValuation: DEFAULT_CLASS_POLICY.automaticValuation,
    automaticSunReyMint: false,
    automaticMoonReyMint: false,
    settlementAuthorizedByRegistration: DEFAULT_CLASS_POLICY.settlementAuthorizedByRegistration,
  });
}
