import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ProviderBalanceId } from '../ids.ts';

/**
 * Provider-neutral externally reported balance.
 * This is never automatically the Ledger balance. Reconciliation compares them.
 */
export type ProviderReportedBalance = {
  readonly providerBalanceId: ProviderBalanceId;
  readonly provider: string;
  readonly externalAccount: string;
  readonly currency: string;
  readonly reportedMinor: bigint;
  readonly availableMinor: bigint | null;
  readonly reportedAt: UtcInstant;
  readonly statementRef: string | null;
  readonly evidenceSource: string;
};

export function freezeProviderReportedBalance(input: ProviderReportedBalance): ProviderReportedBalance {
  if (input.currency.length !== 3) {
    throw new Error('provider balance currency must be ISO-4217 alpha-3');
  }
  return Object.freeze({ ...input });
}
