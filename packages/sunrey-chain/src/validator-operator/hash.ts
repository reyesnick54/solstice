import { createHash } from 'node:crypto';

export function requestHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, inner) => {
    if (typeof inner === 'bigint') {
      return inner.toString();
    }
    return inner;
  });
  return createHash('sha256').update(`sunrey.validator.operator.request.v1\n${canonical}`).digest('hex');
}

export function fingerprintOf(label: string): string {
  return createHash('sha256').update(`sunrey.validator.operator.fingerprint.v1\n${label}`).digest('hex');
}
