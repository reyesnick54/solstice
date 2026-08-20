import { looksLikePlaintextCredential } from '../../../../security/src/regulated/credentials/descriptor.ts';
import { bindingErr, bindingOk, type BindingResult } from './types.ts';

const RAW_SECRET_KEYS = Object.freeze([
  'apiKey',
  'api_key',
  'password',
  'token',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
  'certificatePrivateKey',
  'certificate_private_key',
  'secret',
  'plaintext',
]);

const RAW_SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /api[_-]?key\s*[:=]/i,
  /client_secret\s*[:=]/i,
  /bearer\s+[a-z0-9._-]{8,}/i,
];

export function recordContainsRawSecret(value: unknown, path = 'root'): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    if (value.startsWith('secret://')) {
      return null;
    }
    if (looksLikePlaintextCredential(value) || RAW_SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
      return path;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = recordContainsRawSecret(item, `${path}[${index}]`);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (RAW_SECRET_KEYS.includes(key)) {
        return `${path}.${key}`;
      }
      const found = recordContainsRawSecret(inner, `${path}.${key}`);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function rejectRawSecrets(value: unknown): BindingResult<true> {
  const found = recordContainsRawSecret(value);
  if (found) {
    return bindingErr('RAW_SECRET_REJECTED', `raw secret material is forbidden at ${found}`);
  }
  return bindingOk(true);
}
