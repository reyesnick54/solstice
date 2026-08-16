import type { Clock } from '../../config/src/clock.ts';
import {
  newChainBlockReference,
  newChainReceiptId,
  newChainTransactionId,
  SIMULATION_ADAPTER_ID,
  SIMULATION_CHAIN_ID,
  SIMULATION_NETWORK_ID,
  type ChainBlockReference,
  type ChainOperationId,
  type ChainReceiptId,
  type ChainTransactionId,
} from './ids.ts';
import type { AdapterSubmitResult, SunReyChainAdapter } from './adapter.ts';
import { INITIAL_CHAIN_NETWORK_MODE, type ChainOperationState } from './taxonomy.ts';
import type {
  ChainHealth,
  ChainReceipt,
  ChainWriteIntent,
  SimulationAdapterControls,
} from './types.ts';

type SimulatedTx = {
  readonly operationId: ChainOperationId;
  readonly commitment: string;
  readonly transactionId: ChainTransactionId;
  readonly receiptId: ChainReceiptId;
  blockReference: ChainBlockReference;
  includedAtHeight: number;
  state: ChainOperationState;
  confirmations: number;
  reorgObserved: boolean;
};

export class SimulationChainAdapter implements SunReyChainAdapter {
  readonly adapterId = SIMULATION_ADAPTER_ID;
  readonly chainId = SIMULATION_CHAIN_ID;
  readonly networkId = SIMULATION_NETWORK_ID;
  private height = 1;
  private readonly byOperation = new Map<ChainOperationId, SimulatedTx>();
  private readonly byCommitment = new Map<string, SimulatedTx>();
  private readonly receipts = new Map<ChainReceiptId, ChainReceipt>();
  private controls: SimulationAdapterControls;
  private readonly clock: Clock;

  constructor(clock: Clock, controls: Partial<SimulationAdapterControls> = {}) {
    this.clock = clock;
    this.controls = {
      finalityDelayBlocks: controls.finalityDelayBlocks ?? 2,
      unavailable: controls.unavailable ?? false,
      rejectNext: controls.rejectNext ?? false,
      unknownNext: controls.unknownNext ?? false,
    };
  }

  setControls(patch: Partial<SimulationAdapterControls>): void {
    this.controls = { ...this.controls, ...patch };
  }

  submitCommitment(intent: ChainWriteIntent): AdapterSubmitResult {
    return this.submit(intent);
  }
  submitAttestation(intent: ChainWriteIntent): AdapterSubmitResult {
    return this.submit(intent);
  }
  submitPermissionRecord(intent: ChainWriteIntent): AdapterSubmitResult {
    return this.submit(intent);
  }
  submitRevocation(intent: ChainWriteIntent): AdapterSubmitResult {
    return this.submit(intent);
  }
  submitProvenanceRecord(intent: ChainWriteIntent): AdapterSubmitResult {
    return this.submit(intent);
  }
  submitPolicyRecord(intent: ChainWriteIntent): AdapterSubmitResult {
    return this.submit(intent);
  }
  submitSettlementAnchor(intent: ChainWriteIntent): AdapterSubmitResult {
    return this.submit(intent);
  }

  getOperation(operationId: ChainOperationId): ChainOperationState | undefined {
    return this.byOperation.get(operationId)?.state;
  }

  getReceipt(receiptId: ChainReceiptId): ChainReceipt | undefined {
    return this.receipts.get(receiptId);
  }

  getFinality(operationId: ChainOperationId): {
    readonly state: ChainOperationState;
    readonly confirmations: number;
    readonly blockReference: ChainBlockReference | null;
  } {
    const tx = this.byOperation.get(operationId);
    if (!tx) {
      return { state: 'UNKNOWN', confirmations: 0, blockReference: null };
    }
    return {
      state: tx.state,
      confirmations: tx.confirmations,
      blockReference: tx.blockReference,
    };
  }

  getHealth(): ChainHealth {
    return {
      status: this.controls.unavailable ? 'UNAVAILABLE' : 'AVAILABLE',
      networkMode: INITIAL_CHAIN_NETWORK_MODE,
      adapterId: this.adapterId,
      height: this.height,
      reason: this.controls.unavailable ? 'simulation adapter marked unavailable' : null,
      observedAt: this.clock.now(),
    };
  }

  advanceBlocks(count = 1): void {
    for (let i = 0; i < count; i += 1) {
      this.height += 1;
      for (const tx of this.byOperation.values()) {
        if (tx.state === 'REJECTED' || tx.state === 'FAILED' || tx.state === 'UNKNOWN') {
          continue;
        }
        tx.confirmations = this.height - tx.includedAtHeight;
        if (tx.reorgObserved) {
          tx.state = 'REORG_OBSERVED';
          continue;
        }
        if (tx.confirmations >= this.controls.finalityDelayBlocks) {
          tx.state = 'FINALIZED';
          const receipt = this.receipts.get(tx.receiptId);
          if (receipt) {
            this.receipts.set(tx.receiptId, { ...receipt, finalized: true });
          }
        } else {
          tx.state = 'PENDING_FINALITY';
        }
      }
    }
  }

  observeReorg(operationId: ChainOperationId): boolean {
    const tx = this.byOperation.get(operationId);
    if (!tx) {
      return false;
    }
    tx.reorgObserved = true;
    tx.state = 'REORG_OBSERVED';
    const receipt = this.receipts.get(tx.receiptId);
    if (receipt) {
      this.receipts.set(tx.receiptId, { ...receipt, reorgObserved: true, finalized: false });
    }
    return true;
  }

  private submit(intent: ChainWriteIntent): AdapterSubmitResult {
    if (this.controls.unavailable) {
      return { outcome: 'UNAVAILABLE', reason: 'simulation chain unavailable' };
    }
    const existingOp = this.byOperation.get(intent.operationId);
    if (existingOp) {
      return {
        outcome: 'DUPLICATE',
        transactionId: existingOp.transactionId,
        receiptId: existingOp.receiptId,
        blockReference: existingOp.blockReference,
        state: existingOp.state,
      };
    }
    const existingCommitment = this.byCommitment.get(intent.payloadCommitment);
    if (existingCommitment) {
      return {
        outcome: 'DUPLICATE',
        transactionId: existingCommitment.transactionId,
        receiptId: existingCommitment.receiptId,
        blockReference: existingCommitment.blockReference,
        state: existingCommitment.state,
      };
    }
    if (this.controls.rejectNext) {
      this.controls = { ...this.controls, rejectNext: false };
      return { outcome: 'REJECTED', reason: 'simulation rejected transaction' };
    }
    const transactionId = newChainTransactionId();
    if (this.controls.unknownNext) {
      this.controls = { ...this.controls, unknownNext: false };
      return {
        outcome: 'UNKNOWN',
        transactionId,
        reason: 'timeout after possible broadcast',
      };
    }
    const receiptId = newChainReceiptId();
    const blockReference = newChainBlockReference(this.height);
    const tx: SimulatedTx = {
      operationId: intent.operationId,
      commitment: intent.payloadCommitment,
      transactionId,
      receiptId,
      blockReference,
      includedAtHeight: this.height,
      state: 'ACCEPTED',
      confirmations: 0,
      reorgObserved: false,
    };
    this.byOperation.set(intent.operationId, tx);
    this.byCommitment.set(intent.payloadCommitment, tx);
    this.receipts.set(receiptId, {
      receiptId,
      operationId: intent.operationId,
      transactionId,
      blockReference,
      payloadCommitment: intent.payloadCommitment,
      accepted: true,
      finalized: false,
      reorgObserved: false,
      recordedAt: this.clock.now(),
    });
    return {
      outcome: 'ACCEPTED',
      transactionId,
      receiptId,
      blockReference,
      state: 'ACCEPTED',
    };
  }
}
