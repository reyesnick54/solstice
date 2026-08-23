export const TRANSACTION_FINALITY = ['PENDING', 'INCLUDED', 'FINALIZED', 'FAILED'] as const;
export type TransactionFinality = (typeof TRANSACTION_FINALITY)[number];

export const FINALITY_SOURCES = [
  'MEMPOOL',
  'LOCAL_BLOCK_OBSERVATION',
  'COMMIT_CERTIFICATE',
  'REJECTION',
] as const;
export type FinalitySource = (typeof FINALITY_SOURCES)[number];

export type TransactionObservation = {
  readonly txId: string;
  readonly status: TransactionFinality;
  readonly source: FinalitySource;
  readonly height: number | null;
  readonly localObservationIsNotFinality: boolean;
};

export function classifyFinality(source: FinalitySource): TransactionFinality {
  switch (source) {
    case 'MEMPOOL':
      return 'PENDING';
    case 'LOCAL_BLOCK_OBSERVATION':
      return 'INCLUDED';
    case 'COMMIT_CERTIFICATE':
      return 'FINALIZED';
    case 'REJECTION':
      return 'FAILED';
  }
}

export function observeTransaction(
  txId: string,
  source: FinalitySource,
  height: number | null,
): TransactionObservation {
  return {
    txId,
    status: classifyFinality(source),
    source,
    height,
    localObservationIsNotFinality: source !== 'COMMIT_CERTIFICATE',
  };
}
