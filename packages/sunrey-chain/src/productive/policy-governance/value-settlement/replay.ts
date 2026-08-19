import type { ProductiveSettlementBook, SettledValueRecord } from './types.ts';

export function emptySettlementBook(): ProductiveSettlementBook {
  return {
    settledReplayKeys: new Set(),
    settledFingerprints: new Map(),
    settledEventIds: new Set(),
    settledValueIds: new Set(),
    settledValueDigests: new Set(),
    settledAuthorizationIds: new Set(),
    issuedByEvent: new Map(),
    issuedByObject: new Map(),
    issuedByController: new Map(),
    issuedByCategoryEpoch: new Map(),
    issuedByGlobalEpoch: new Map(),
  };
}

export function replayKeyOf(input: {
  readonly contributionFingerprint: string;
  readonly eventId: string;
  readonly productiveValueId: string;
  readonly productiveValueDigest: string;
  readonly authorizationId: string;
  readonly conversionPolicyVersion: string;
}): string {
  return [
    input.contributionFingerprint,
    input.eventId,
    input.productiveValueId,
    input.productiveValueDigest,
    input.authorizationId,
    input.conversionPolicyVersion,
  ].join(':');
}

export function recordSettlement(
  book: ProductiveSettlementBook,
  record: SettledValueRecord,
  usageKeys: {
    readonly objectId: string;
    readonly controller: string;
    readonly categoryEpoch: string;
    readonly globalEpoch: string;
  },
): void {
  book.settledReplayKeys.add(
    replayKeyOf({
      contributionFingerprint: record.contributionFingerprint,
      eventId: record.eventId,
      productiveValueId: record.productiveValueId,
      productiveValueDigest: record.productiveValueDigest,
      authorizationId: record.authorizationId,
      conversionPolicyVersion: record.conversionPolicyVersion,
    }),
  );
  book.settledFingerprints.set(record.contributionFingerprint, record);
  book.settledEventIds.add(record.eventId);
  book.settledValueIds.add(record.productiveValueId);
  book.settledValueDigests.add(record.productiveValueDigest);
  book.settledAuthorizationIds.add(record.authorizationId);
  add(book.issuedByEvent, record.eventId, record.quantity);
  add(book.issuedByObject, usageKeys.objectId, record.quantity);
  add(book.issuedByController, usageKeys.controller, record.quantity);
  add(book.issuedByCategoryEpoch, usageKeys.categoryEpoch, record.quantity);
  add(book.issuedByGlobalEpoch, usageKeys.globalEpoch, record.quantity);
}

function add(map: Map<string, bigint>, key: string, quantity: bigint): void {
  map.set(key, (map.get(key) ?? 0n) + quantity);
}
