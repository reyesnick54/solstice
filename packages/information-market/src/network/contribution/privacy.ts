import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { HinContributionFailure } from './contract.ts';

export const FORBIDDEN_REGISTRY_KEYS = Object.freeze([
  'legalName',
  'legal_name',
  'email',
  'phone',
  'ssn',
  'passport',
  'kyc',
  'rawKyc',
  'rawPdv',
  'rawPdvData',
  'healthData',
  'rawHealth',
  'locationRows',
  'rawLocation',
  'sourceRows',
  'cleanRoomSourceRows',
  'password',
  'secret',
  'authenticationSecret',
  'authSecret',
]);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;
const PHONE_PATTERN = /\b\+?\d{1,3}[-. ]?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/;
const PASSPORT_PATTERN = /\bpassport\b/i;

export function assertPrivacySafeRegistryPayload(
  value: unknown,
): Result<true, HinContributionFailure> {
  const seen = new Set<unknown>();
  const walk = (node: unknown, path: string): string | null => {
    if (node === null || node === undefined) {
      return null;
    }
    if (typeof node === 'string') {
      if (EMAIL_PATTERN.test(node) || SSN_PATTERN.test(node) || PHONE_PATTERN.test(node) || PASSPORT_PATTERN.test(node)) {
        return path;
      }
      return null;
    }
    if (typeof node !== 'object') {
      return null;
    }
    if (seen.has(node)) {
      return null;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      for (const [index, item] of node.entries()) {
        const hit = walk(item, `${path}[${String(index)}]`);
        if (hit) {
          return hit;
        }
      }
      return null;
    }
    for (const [key, child] of Object.entries(node)) {
      if (FORBIDDEN_REGISTRY_KEYS.includes(key)) {
        return `${path}.${key}`;
      }
      const hit = walk(child, `${path}.${key}`);
      if (hit) {
        return hit;
      }
    }
    return null;
  };
  const leaked = walk(value, 'record');
  if (leaked) {
    return err({
      code: 'RAW_PERSONAL_DATA_FORBIDDEN',
      message: `registry payload must not carry raw personal information at ${leaked}`,
    });
  }
  return ok(true);
}
