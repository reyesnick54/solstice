import type { Result } from '../../../../domain/src/result.ts';
import type {
  ChainOperationId,
  ChainReceiptId,
  ChainWriteIntentId,
} from '../../../../sunrey-chain/src/ids.ts';
import type { CreateIntentInput, SunReyChainService } from '../../../../sunrey-chain/src/service.ts';
import type {
  ChainFailure,
  ChainHealth,
  ChainOperation,
  ChainReceipt,
  ChainWriteIntent,
  ReconciliationRecord,
} from '../../../../sunrey-chain/src/types.ts';
import type {
  HinChainFinality,
  HumanInformationChainAnchorRuntime,
} from './port.ts';

/**
 * Narrow adapter over {@link SunReyChainService}.
 *
 * HIN domain logic must not call SimulationChainAdapter directly.
 */
export class SunReyHumanInformationChainAnchorAdapter implements HumanInformationChainAnchorRuntime {
  constructor(private readonly chain: SunReyChainService) {}

  createIntent(input: CreateIntentInput): Result<ChainWriteIntent, ChainFailure> {
    return this.chain.createIntent(input);
  }

  submit(intentId: ChainWriteIntentId): Result<ChainOperation, ChainFailure> {
    return this.chain.submit(intentId);
  }

  getIntent(intentId: ChainWriteIntentId): ChainWriteIntent | undefined {
    return this.chain.getIntent(intentId);
  }

  getOperation(operationId: ChainOperationId): ChainOperation | undefined {
    return this.chain.getOperation(operationId);
  }

  getReceipt(receiptId: ChainReceiptId): ChainReceipt | undefined {
    return this.chain.snapshot().receipts.find((row) => row.receiptId === receiptId);
  }

  getFinality(operationId: ChainOperationId): HinChainFinality | undefined {
    const operation = this.chain.getOperation(operationId);
    if (!operation) {
      return undefined;
    }
    return {
      state: operation.state,
      confirmations: operation.confirmations,
      blockReference: operation.blockReference,
      transactionId: operation.transactionId,
      receiptId: operation.receiptId,
      payloadCommitment: operation.payloadCommitment,
      unknownAfterBroadcast: operation.unknownAfterBroadcast,
    };
  }

  reconcile(operationId: ChainOperationId): Result<ReconciliationRecord, ChainFailure> {
    return this.chain.reconcile(operationId);
  }

  getHealth(): ChainHealth {
    return this.chain.getHealth();
  }

  advanceFinality(blocks?: number): void {
    this.chain.advanceFinality(blocks);
  }

  observeReorg(operationId: ChainOperationId): Result<ChainOperation, ChainFailure> {
    return this.chain.observeReorg(operationId);
  }

  setUnavailable(unavailable: boolean): void {
    this.chain.simulationAdapter.setControls({ unavailable });
  }

  setUnknownNext(unknownNext: boolean): void {
    this.chain.simulationAdapter.setControls({ unknownNext });
  }

  setRejectNext(rejectNext: boolean): void {
    this.chain.simulationAdapter.setControls({ rejectNext });
  }
}

export function createHumanInformationChainAnchorPort(
  chain: SunReyChainService,
): HumanInformationChainAnchorRuntime {
  return new SunReyHumanInformationChainAnchorAdapter(chain);
}
