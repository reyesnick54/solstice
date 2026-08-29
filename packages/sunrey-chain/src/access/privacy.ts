import {
  ACCESS_FORBIDDEN_PAYLOAD_KEYS,
  ACCESS_FORBIDDEN_VALUE_PATTERNS,
  ACCESS_LABEL_SHAPE,
} from './taxonomy.ts';
import type { AccessChainFailure } from './types.ts';

const COMMITMENT_VALUE = /^[0-9a-f]{64}$/;
const INTEGER_LABEL = /^-?\d+$/;
const DIGIT_RUN = /\d{13,19}/;

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

const FORBIDDEN_KEYS = new Set(ACCESS_FORBIDDEN_PAYLOAD_KEYS.map(normalizeKey));

function forbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(normalizeKey(key));
}

/**
 * Commitments and integer labels are structurally opaque. Scanning them for
 * personal-data shapes only produces false positives, so they are skipped and
 * every other string is checked in full.
 */
function forbiddenValue(value: string): boolean {
  if (COMMITMENT_VALUE.test(value) || INTEGER_LABEL.test(value)) {
    return false;
  }
  if (DIGIT_RUN.test(value)) {
    return true;
  }
  return ACCESS_FORBIDDEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Access-domain privacy boundary applied before anything reaches the chain
 * classification gate. Itineraries, travel history, health material, personal
 * preferences, and payment credentials never become a chain payload; only
 * commitments, identifiers, references, timestamps, and state do.
 */
export function assertPrivacySafeAccessFields(
  fields: Readonly<Record<string, string | number | boolean | null>>,
): AccessChainFailure | null {
  for (const [key, value] of Object.entries(fields)) {
    if (forbiddenKey(key)) {
      return {
        code: 'ACCESS_PRIVACY_VIOLATION',
        message: `field ${key} is off-chain only for the Access Fabric`,
      };
    }
    if (typeof value === 'string' && forbiddenValue(value)) {
      return {
        code: 'ACCESS_PRIVACY_VIOLATION',
        message: `field ${key} carries personal material that may not be written on chain`,
      };
    }
  }
  return null;
}

/**
 * Caller-supplied labels are hashed before they reach a chain payload, but a
 * commitment over personal material is still personal material with a delay.
 * Labels are therefore screened before they are committed, and must be short
 * controlled tokens rather than prose.
 */
export function assertPrivacySafeAccessLabels(
  labels: Readonly<Record<string, string | readonly string[] | undefined>>,
): AccessChainFailure | null {
  for (const [key, value] of Object.entries(labels)) {
    if (value === undefined) {
      continue;
    }
    if (forbiddenKey(key)) {
      return {
        code: 'ACCESS_PRIVACY_VIOLATION',
        message: `${key} is off-chain only for the Access Fabric`,
      };
    }
    const values = typeof value === 'string' ? [value] : value;
    for (const entry of values) {
      if (!ACCESS_LABEL_SHAPE.test(entry)) {
        return {
          code: 'ACCESS_PRIVACY_VIOLATION',
          message: `${key} must be a short controlled token, not free text that could carry personal detail`,
        };
      }
      if (forbiddenValue(entry)) {
        return {
          code: 'ACCESS_PRIVACY_VIOLATION',
          message: `${key} carries personal material that may not be committed on chain`,
        };
      }
    }
  }
  return null;
}
