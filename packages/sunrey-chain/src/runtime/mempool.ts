export type MempoolPolicy = {
  readonly maxCount: number;
  readonly maxBytes: number;
  readonly maxPerActor: number;
  readonly ttlMs: number;
  readonly preferHigherFee: true;
  readonly persistAcrossRestart: boolean;
};

export const DEFAULT_MEMPOOL_POLICY: MempoolPolicy = {
  maxCount: 1024,
  maxBytes: 2_000_000,
  maxPerActor: 16,
  ttlMs: 60_000,
  preferHigherFee: true,
  persistAcrossRestart: true,
};

export type MempoolAdmission =
  | { readonly ok: true; readonly txId: string }
  | { readonly ok: false; readonly reason: 'DUPLICATE' | 'CAPACITY' | 'EXPIRED' | 'INVALID' | 'SPAM' };

export function admitToMempool(input: {
  readonly knownIds: ReadonlySet<string>;
  readonly count: number;
  readonly bytes: number;
  readonly perActor: number;
  readonly txId: string;
  readonly size: number;
  readonly expired: boolean;
  readonly valid: boolean;
  readonly policy?: MempoolPolicy;
}): MempoolAdmission {
  const policy = input.policy ?? DEFAULT_MEMPOOL_POLICY;
  if (!input.valid) {
    return { ok: false, reason: 'INVALID' };
  }
  if (input.expired) {
    return { ok: false, reason: 'EXPIRED' };
  }
  if (input.knownIds.has(input.txId)) {
    return { ok: false, reason: 'DUPLICATE' };
  }
  if (input.count >= policy.maxCount || input.bytes + input.size > policy.maxBytes) {
    return { ok: false, reason: 'CAPACITY' };
  }
  if (input.perActor >= policy.maxPerActor) {
    return { ok: false, reason: 'SPAM' };
  }
  return { ok: true, txId: input.txId };
}

export function selectByFeePriority(
  items: ReadonlyArray<{ readonly txId: string; readonly fee: bigint }>,
): string[] {
  return [...items]
    .sort((left, right) => {
      if (left.fee === right.fee) {
        return left.txId < right.txId ? -1 : 1;
      }
      return left.fee > right.fee ? -1 : 1;
    })
    .map((item) => item.txId);
}
