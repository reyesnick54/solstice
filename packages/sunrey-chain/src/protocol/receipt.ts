/**
 * Deterministic transaction result semantics.
 *
 * ACCEPTED means admission validation passed. FINALIZED requires a commit
 * certificate — local observation or mempool admission alone is not finality.
 */

export const TRANSACTION_LIFECYCLE_STAGES = [
  'CREATED',
  'SIGNED',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'INCLUDED',
  'EXECUTED',
  'FINALIZED',
] as const;
export type TransactionLifecycleStage = (typeof TRANSACTION_LIFECYCLE_STAGES)[number];

export const TRANSACTION_RESULT_SOURCES = [
  'STATELESS_VALIDATION',
  'AUTHENTICATION',
  'REPLAY_GUARD',
  'STATEFUL_VALIDATION',
  'MEMPOOL_ADMISSION',
  'BLOCK_INCLUSION',
  'EXECUTION',
  'COMMIT_CERTIFICATE',
  'REJECTION',
] as const;
export type TransactionResultSource = (typeof TRANSACTION_RESULT_SOURCES)[number];

export type TransactionReceipt = {
  readonly transactionId: string;
  readonly stage: TransactionLifecycleStage;
  readonly source: TransactionResultSource;
  readonly accepted: boolean;
  readonly executed: boolean;
  readonly finalized: boolean;
  readonly height: number | null;
  readonly rejectionCode: string | null;
  readonly blockId: string | null;
  readonly observedAtUtc: string;
};

export function receiptForStage(input: {
  readonly transactionId: string;
  readonly stage: TransactionLifecycleStage;
  readonly source: TransactionResultSource;
  readonly rejectionCode?: string | null;
  readonly height?: number | null;
  readonly blockId?: string | null;
  readonly observedAtUtc?: string;
}): TransactionReceipt {
  const accepted = input.stage !== 'REJECTED';
  const executed = input.stage === 'EXECUTED' || input.stage === 'FINALIZED';
  const finalized = input.stage === 'FINALIZED';
  return Object.freeze({
    transactionId: input.transactionId,
    stage: input.stage,
    source: input.source,
    accepted,
    executed,
    finalized,
    height: input.height ?? null,
    rejectionCode: input.rejectionCode ?? null,
    blockId: input.blockId ?? null,
    observedAtUtc: input.observedAtUtc ?? new Date().toISOString(),
  });
}

export function advanceReceipt(
  current: TransactionReceipt,
  next: TransactionLifecycleStage,
  source: TransactionResultSource,
  patch?: Partial<Pick<TransactionReceipt, 'height' | 'blockId' | 'rejectionCode'>>,
): TransactionReceipt {
  return receiptForStage({
    transactionId: current.transactionId,
    stage: next,
    source,
    rejectionCode: patch?.rejectionCode ?? current.rejectionCode,
    height: patch?.height ?? current.height,
    blockId: patch?.blockId ?? current.blockId,
    observedAtUtc: new Date().toISOString(),
  });
}

export function mempoolAdmissionIsNotFinality(receipt: TransactionReceipt): boolean {
  return receipt.stage === 'ACCEPTED' && receipt.source === 'MEMPOOL_ADMISSION' && !receipt.finalized;
}
