import { createHash } from 'node:crypto';

export function sha256CanonicalJson(value: unknown): string {
  const body = JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
  return createHash('sha256').update(body, 'utf8').digest('hex');
}
