/**
 * Privacy-safe logging for compliance screening queries.
 */

import { createHash } from 'node:crypto';

const SENSITIVE_KEYS = new Set([
  'dateOfBirth',
  'date_of_birth',
  'dob',
  'passport',
  'nationalId',
  'national_id',
  'address',
  'ssn',
]);

export function privacySafeSubjectRef(subjectId: string | null, requestId: string): string {
  const material = subjectId ?? requestId;
  return `subj_${createHash('sha256').update(material).digest('hex').slice(0, 16)}`;
}

export function privacySafeEvidenceLogRef(evidenceId: string): string {
  return `evd_${evidenceId.slice(0, 8)}`;
}

export function sanitizeComplianceLogPayload(
  payload: Record<string, unknown>,
): Record<string, string | null> {
  const safe: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key)) {
      safe[key] = '[REDACTED]';
      continue;
    }
    if (typeof value === 'string') {
      safe[key] = value.length > 64 ? `${value.slice(0, 8)}…` : value;
    } else if (value == null) {
      safe[key] = null;
    } else {
      safe[key] = '[REDACTED]';
    }
  }
  return Object.freeze(safe);
}

export function assertNoSensitiveDataInLog(line: string): void {
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(line) && /dob|birth/i.test(line)) {
    throw new Error('compliance log must not contain date of birth');
  }
  if (/\b[A-Z]{1,2}\d{6,9}\b/.test(line) && /passport|national/i.test(line)) {
    throw new Error('compliance log must not contain document identifiers');
  }
}
