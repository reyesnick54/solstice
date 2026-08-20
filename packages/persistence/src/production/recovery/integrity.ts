import { existsSync, readFileSync } from 'node:fs';

import { DurableStoreError } from '../snapshot-envelope.ts';
import type { RecoveryIntegrityFinding } from './types.ts';

const FORBIDDEN_SECRET_PATTERNS = [
  /Authorization\s*:/i,
  /BEGIN ([A-Z ]+)?PRIVATE KEY/,
  /api[_-]?key\s*[:=]/i,
  /client_secret/i,
  /oauth[^"]*access[_-]?token/i,
  /biometric/i,
  /travel[_-]?rule[_-]?plaintext/i,
];

export function scanForForbiddenSecrets(text: string): readonly RecoveryIntegrityFinding[] {
  const findings: RecoveryIntegrityFinding[] = [];
  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    if (pattern.test(text)) {
      findings.push({
        code: 'FORBIDDEN_SECRET_MATERIAL',
        failClosed: true,
        message: `operational persistence matched forbidden pattern ${pattern.source}`,
      });
    }
  }
  return findings;
}

export function validateFixtureOrThrow(path: string, opener: () => unknown): RecoveryIntegrityFinding[] {
  if (!existsSync(path)) {
    opener();
    return [];
  }
  try {
    opener();
    return [];
  } catch (error) {
    if (error instanceof DurableStoreError) {
      throw error;
    }
    throw error;
  }
}

export function fileContainsForbiddenSecrets(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }
  return scanForForbiddenSecrets(readFileSync(path, 'utf8')).length > 0;
}
