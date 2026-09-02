/**
 * Consumed issuance and burn authorization tracking.
 *
 * Issuance requires stronger replay protection than ordinary transfers.
 * The same governance authorization identifier must never create supply twice.
 */

import type { NativeAssetId } from './assets.ts';

export type IssuanceAuthorizationRef = {
  readonly assetId: NativeAssetId;
  readonly authorizationId: string;
  readonly issuanceClass: string;
};

export function issuanceReplayKey(ref: IssuanceAuthorizationRef): string {
  return `${ref.assetId}:${ref.issuanceClass}:${ref.authorizationId}`;
}

export class ConsumedAuthorizationRegistry {
  private readonly consumed = new Set<string>();

  isConsumed(ref: IssuanceAuthorizationRef): boolean {
    return this.consumed.has(issuanceReplayKey(ref));
  }

  consume(ref: IssuanceAuthorizationRef): 'OK' | 'DUPLICATE_ISSUANCE' {
    const key = issuanceReplayKey(ref);
    if (this.consumed.has(key)) {
      return 'DUPLICATE_ISSUANCE';
    }
    this.consumed.add(key);
    return 'OK';
  }

  snapshot(): readonly string[] {
    return Object.freeze([...this.consumed].sort());
  }

  restore(keys: readonly string[]): void {
    this.consumed.clear();
    for (const key of keys) {
      this.consumed.add(key);
    }
  }
}

export function extractIssuanceAuthorization(
  operation: string,
  authorizationRef: string,
  assetId: NativeAssetId,
): IssuanceAuthorizationRef | null {
  if (operation !== 'ISSUE' && operation !== 'BURN') {
    return null;
  }
  if (authorizationRef.length === 0) {
    return null;
  }
  return Object.freeze({
    assetId,
    authorizationId: authorizationRef,
    issuanceClass: operation === 'ISSUE' ? 'GOVERNED_ISSUANCE' : 'GOVERNED_BURN',
  });
}
