import type { Result } from '../../../../domain/src/result.ts';
import type {
  ChainBlockReference,
  ChainOperationId,
  ChainReceiptId,
  ChainTransactionId,
  ChainWriteIntentId,
} from '../../../../sunrey-chain/src/ids.ts';
import type { CreateIntentInput } from '../../../../sunrey-chain/src/service.ts';
import type { ChainOperationState } from '../../../../sunrey-chain/src/taxonomy.ts';
import type {
  ChainFailure,
  ChainHealth,
  ChainOperation,
  ChainReceipt,
  ChainWriteIntent,
  ReconciliationRecord,
} from '../../../../sunrey-chain/src/types.ts';

/**
 * Narrow HIN → SunRey Chain port.
 *
 * HIN may create intents, submit, read finality, and reconcile.
 * HIN must not implement blocks, consensus, validators, a mempool,
 * signing protocol, state roots, or a reorg algorithm.
 */
export type HumanInformationChainAnchorPort = {
  createIntent(input: CreateIntentInput): Result<ChainWriteIntent, ChainFailure>;
  submit(intentId: ChainWriteIntentId): Result<ChainOperation, ChainFailure>;
  getIntent(intentId: ChainWriteIntentId): ChainWriteIntent | undefined;
  getOperation(operationId: ChainOperationId): ChainOperation | undefined;
  getReceipt(receiptId: ChainReceiptId): ChainReceipt | undefined;
  getFinality(operationId: ChainOperationId): HinChainFinality | undefined;
  reconcile(operationId: ChainOperationId): Result<ReconciliationRecord, ChainFailure>;
  getHealth(): ChainHealth;
};

export type HinChainFinality = {
  readonly state: ChainOperationState;
  readonly confirmations: number;
  readonly blockReference: ChainBlockReference | null;
  readonly transactionId: ChainTransactionId | null;
  readonly receiptId: ChainReceiptId | null;
  readonly payloadCommitment: string;
  readonly unknownAfterBroadcast: boolean;
};

/**
 * Simulation-only controls. Tests and the demo may advance the existing
 * chain lifecycle. Production code never invents a block height from
 * HIN wall-clock time.
 */
export type HumanInformationChainSimulationControls = {
  advanceFinality(blocks?: number): void;
  observeReorg(operationId: ChainOperationId): Result<ChainOperation, ChainFailure>;
  setUnavailable(unavailable: boolean): void;
  setUnknownNext(unknownNext: boolean): void;
  setRejectNext(rejectNext: boolean): void;
};

export type HumanInformationChainAnchorRuntime = HumanInformationChainAnchorPort &
  Partial<HumanInformationChainSimulationControls>;
