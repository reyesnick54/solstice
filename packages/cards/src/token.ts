import type { UtcInstant } from '../../domain/src/time.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';
import type { CardId, NetworkTokenReference } from './ids.ts';

export const NETWORK_TOKEN_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'] as const;
export type NetworkTokenStatus = (typeof NETWORK_TOKEN_STATUSES)[number];

/**
 * Card-token metadata for future mobile-wallet provisioning (Chunk 12).
 * This is not Apple Pay or Google Wallet implementation.
 */
export type CardNetworkToken = {
  readonly tokenRef: NetworkTokenReference;
  readonly cardId: CardId;
  readonly tokenRequestor: string;
  readonly deviceRef: string | null;
  readonly status: NetworkTokenStatus;
  readonly assurance: string;
  readonly createdAt: UtcInstant;
};

export function freezeNetworkToken(token: CardNetworkToken): CardNetworkToken {
  assertNoSensitiveCardData(token, 'networkToken');
  return Object.freeze({ ...token });
}
