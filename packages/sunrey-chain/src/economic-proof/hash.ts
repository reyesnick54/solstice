import { sha256Hex } from '../../../security/src/hash.ts';

export const ECONOMIC_PROOF_DOMAIN = 'sunrey.economic-proof.v1' as const;

export function economicProofDigest(parts: readonly string[]): string {
  return sha256Hex([ECONOMIC_PROOF_DOMAIN, ...parts].join('|'));
}

export function sortedJoin(values: readonly string[]): string {
  return [...values].sort().join(',');
}
