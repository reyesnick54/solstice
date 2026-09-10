/**
 * Canonical Alpha-chain custody addresses for Exchange account bindings.
 */

import { encodeFromPublicKey, publicDescriptorFromSeed, seedFromLabel } from '../wallet/index.ts';
import { SUNREY_INTERNAL_ALPHA_NETWORK_ID } from './identity.ts';

export function exchangeCustodyAddress(customerId: string): string {
  const descriptor = publicDescriptorFromSeed(
    customerId,
    seedFromLabel(`sunrey.exchange.internal-alpha.custody:${customerId}`),
  );
  return encodeFromPublicKey(SUNREY_INTERNAL_ALPHA_NETWORK_ID, 'INSTITUTIONAL_ACCOUNT', descriptor).text;
}

export function exchangeDepositAddress(customerId: string): string {
  return exchangeCustodyAddress(customerId);
}
