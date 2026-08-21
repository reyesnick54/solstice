import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SuspenseItemId } from '../ids.ts';

export const SUSPENSE_STATUSES = ['OPEN', 'REVIEW_REQUIRED', 'ATTRIBUTED', 'RELEASED'] as const;
export type SuspenseStatus = (typeof SUSPENSE_STATUSES)[number];

/**
 * Visible suspense for funds or events that cannot yet be attributed.
 * Unresolved money must not hide inside generic transaction states.
 */
export type SuspenseItem = {
  readonly suspenseId: SuspenseItemId;
  readonly treasuryAccountId: string;
  readonly currency: string;
  readonly amountMinor: bigint;
  readonly reason: string;
  readonly domain: string;
  readonly provider: string | null;
  readonly internalReferences: readonly string[];
  readonly externalReferences: readonly string[];
  readonly status: SuspenseStatus;
  readonly createdAt: UtcInstant;
  readonly reviewedAt: UtcInstant | null;
};

export function freezeSuspenseItem(input: SuspenseItem): SuspenseItem {
  return Object.freeze({
    ...input,
    internalReferences: Object.freeze([...input.internalReferences]),
    externalReferences: Object.freeze([...input.externalReferences]),
  });
}

export function isSuspenseAging(item: SuspenseItem, now: UtcInstant, agingMs: bigint): boolean {
  if (item.status === 'ATTRIBUTED' || item.status === 'RELEASED') {
    return false;
  }
  return BigInt(Date.parse(now) - Date.parse(item.createdAt)) >= agingMs;
}
