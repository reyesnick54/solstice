/**
 * Immutable cancel/replace chain: original → replacement → replacement.
 * Original client order identity is never overwritten.
 */

export type BrokerOrderChainLinkKind = 'ORIGINAL' | 'REPLACEMENT';

export type BrokerOrderChainLink = Readonly<{
  readonly clientOrderId: string;
  readonly originalClientOrderId: string;
  readonly linkKind: BrokerOrderChainLinkKind;
  readonly brokerOrderId: string | null;
  readonly supersedesClientOrderId: string | null;
  readonly supersededByClientOrderId: string | null;
  readonly recordedAt: string;
}>;

export type BrokerOrderChain = Readonly<{
  readonly originalClientOrderId: string;
  readonly links: readonly BrokerOrderChainLink[];
}>;

export function createBrokerOrderChain(originalClientOrderId: string, recordedAt: string): BrokerOrderChain {
  const link: BrokerOrderChainLink = Object.freeze({
    clientOrderId: originalClientOrderId,
    originalClientOrderId,
    linkKind: 'ORIGINAL',
    brokerOrderId: null,
    supersedesClientOrderId: null,
    supersededByClientOrderId: null,
    recordedAt,
  });
  return Object.freeze({
    originalClientOrderId,
    links: Object.freeze([link]),
  });
}

export function appendBrokerReplacementLink(
  chain: BrokerOrderChain,
  input: {
    readonly clientOrderId: string;
    readonly brokerOrderId: string | null;
    readonly replacesClientOrderId: string;
    readonly recordedAt: string;
  },
): BrokerOrderChain | { readonly ok: false; readonly reason: string } {
  const predecessor = chain.links.find((row) => row.clientOrderId === input.replacesClientOrderId);
  if (!predecessor) {
    return { ok: false, reason: 'replaces_client_order_id_not_in_chain' };
  }
  if (predecessor.supersededByClientOrderId !== null) {
    return { ok: false, reason: 'predecessor_already_superseded' };
  }
  if (input.clientOrderId === chain.originalClientOrderId) {
    return { ok: false, reason: 'cannot_reuse_original_client_order_id' };
  }
  const existing = chain.links.find((row) => row.clientOrderId === input.clientOrderId);
  if (existing) {
    return { ok: false, reason: 'client_order_id_already_in_chain' };
  }

  const updatedPredecessor: BrokerOrderChainLink = Object.freeze({
    ...predecessor,
    supersededByClientOrderId: input.clientOrderId,
  });

  const replacement: BrokerOrderChainLink = Object.freeze({
    clientOrderId: input.clientOrderId,
    originalClientOrderId: chain.originalClientOrderId,
    linkKind: 'REPLACEMENT',
    brokerOrderId: input.brokerOrderId,
    supersedesClientOrderId: input.replacesClientOrderId,
    supersededByClientOrderId: null,
    recordedAt: input.recordedAt,
  });

  const links = chain.links.map((row) =>
    row.clientOrderId === predecessor.clientOrderId ? updatedPredecessor : row,
  );
  return Object.freeze({
    originalClientOrderId: chain.originalClientOrderId,
    links: Object.freeze([...links, replacement]),
  });
}

export function activeBrokerChainClientOrderId(chain: BrokerOrderChain): string {
  for (let i = chain.links.length - 1; i >= 0; i -= 1) {
    const link = chain.links[i];
    if (link.supersededByClientOrderId === null) {
      return link.clientOrderId;
    }
  }
  return chain.originalClientOrderId;
}
