import { SENSITIVE_FIELD_MARKERS } from '../protocol/constants.ts';

const BLOCK_FORBIDDEN_PATTERNS = [
  /healthRecord/i,
  /geneticData/i,
  /dna/i,
  /rawCommunication/i,
  /privateKey/i,
  /apiSecret/i,
  /providerCredential/i,
  /ssn/i,
  /iban/i,
] as const;

function containsSensitiveKey(key: string): boolean {
  if ((SENSITIVE_FIELD_MARKERS as readonly string[]).includes(key)) {
    return true;
  }
  return BLOCK_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(key));
}

export function scanForForbiddenBlockPayload(value: unknown, path = 'root'): readonly string[] {
  const violations: string[] = [];
  if (value === null || typeof value === 'bigint' || typeof value !== 'object') {
    return violations;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      violations.push(...scanForForbiddenBlockPayload(child, `${path}[${index}]`));
    });
    return violations;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (containsSensitiveKey(key)) {
      violations.push(`${path}.${key}`);
    }
    violations.push(...scanForForbiddenBlockPayload(child, `${path}.${key}`));
  }
  return violations;
}

export function assertBlockPayloadPrivacySafe(value: unknown): void {
  const violations = scanForForbiddenBlockPayload(value);
  if (violations.length > 0) {
    throw new Error(`block payload contains forbidden sensitive fields: ${violations.join(', ')}`);
  }
}

export function isCommitmentOnlyPayload(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const allowed = new Set([
    'schemaVersion',
    'commitmentHash',
    'contentHash',
    'provenanceHash',
    'evidenceId',
    'evidenceType',
    'issuerProvider',
    'temporalRef',
    'verification',
    'bundleId',
    'bundleRoot',
    'claimId',
    'claimFingerprint',
    'economy',
    'role',
    'evidenceRootHex',
    'rightsRootHex',
    'policyRootHex',
  ]);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (!allowed.has(key)) {
      return false;
    }
  }
  return scanForForbiddenBlockPayload(value).length === 0;
}
