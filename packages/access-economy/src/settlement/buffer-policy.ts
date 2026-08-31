/**
 * Versioned authorization buffer policy for restricted Access virtual cards.
 *
 * Cards are limited to the exact service amount by default. A narrow buffer is
 * permitted only where issuer authorization behavior requires it.
 */

export const ACCESS_CARD_BUFFER_POLICY_VERSION = '1.0.0' as const;

export type AccessCardBufferPolicy = {
  readonly version: typeof ACCESS_CARD_BUFFER_POLICY_VERSION;
  /** Basis points above service amount (100 bps = 1%). Zero means exact amount. */
  readonly bufferBps: number;
  /** Hard cap on buffer in minor units regardless of bps. */
  readonly maxBufferMinorUnits: bigint;
  readonly reason: string;
};

/** Default: exact service amount, no buffer. */
export const DEFAULT_ACCESS_CARD_BUFFER_POLICY: AccessCardBufferPolicy = Object.freeze({
  version: ACCESS_CARD_BUFFER_POLICY_VERSION,
  bufferBps: 0,
  maxBufferMinorUnits: 0n,
  reason: 'exact service amount; no incidental buffer at launch',
});

/** Lodging incremental-auth buffer — only when issuer requires pre-auth headroom. */
export const LODGING_INCREMENTAL_AUTH_BUFFER_POLICY: AccessCardBufferPolicy = Object.freeze({
  version: ACCESS_CARD_BUFFER_POLICY_VERSION,
  bufferBps: 0,
  maxBufferMinorUnits: 0n,
  reason: 'lodging security deposits are user-funded; Access card covers service amount only',
});

export function computeCardSpendingLimit(
  serviceAmountMinorUnits: bigint,
  policy: AccessCardBufferPolicy = DEFAULT_ACCESS_CARD_BUFFER_POLICY,
): bigint {
  if (policy.bufferBps === 0 && policy.maxBufferMinorUnits === 0n) {
    return serviceAmountMinorUnits;
  }
  const bpsBuffer = (serviceAmountMinorUnits * BigInt(policy.bufferBps)) / 10_000n;
  const buffer =
    bpsBuffer > policy.maxBufferMinorUnits ? policy.maxBufferMinorUnits : bpsBuffer;
  return serviceAmountMinorUnits + buffer;
}
