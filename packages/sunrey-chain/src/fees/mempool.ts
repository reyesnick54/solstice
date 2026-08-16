import { calculateFee } from './schedule.ts';
import { usageForOperation } from './meter.ts';
import { PRIORITY_SCALE, totalUnits, type ExecutableTransaction } from './types.ts';
import type { FeeEngine } from './engine.ts';
import type { BlockResourceLimits, FeeRejection } from './types.ts';

/**
 * Deterministic mempool selection:
 * 1. effective fee priority descending
 *    priority = (max_fee * PRIORITY_SCALE) / max(max_execution_units, 1)
 * 2. transaction_id ascending (canonical hex)
 *
 * Local arrival time is not used. Validators that see the same admitted
 * set therefore select the same prefix independently.
 */
export function effectiveFeePriority(tx: ExecutableTransaction): bigint {
  const units = tx.budget.maxExecutionUnits === 0n ? 1n : tx.budget.maxExecutionUnits;
  return (tx.budget.maxFee * PRIORITY_SCALE) / units;
}

export function compareForSelection(left: ExecutableTransaction, right: ExecutableTransaction): number {
  const leftPriority = effectiveFeePriority(left);
  const rightPriority = effectiveFeePriority(right);
  if (leftPriority > rightPriority) {
    return -1;
  }
  if (leftPriority < rightPriority) {
    return 1;
  }
  return left.transactionId < right.transactionId ? -1 : left.transactionId > right.transactionId ? 1 : 0;
}

export class FeeMempool {
  private readonly byId = new Map<string, ExecutableTransaction>();
  private readonly engine: FeeEngine;

  constructor(engine: FeeEngine) {
    this.engine = engine;
  }

  admit(tx: ExecutableTransaction): FeeRejection | null {
    if (this.byId.has(tx.transactionId)) {
      return { code: 'INVALID_RESOURCE_DECLARATION', stage: 'mempool', detail: 'duplicate transaction id' };
    }
    const rejection = this.engine.validateAdmission(tx);
    if (rejection) {
      return rejection;
    }
    const reserved = this.engine.reserve(tx);
    if (reserved) {
      return reserved;
    }
    this.byId.set(tx.transactionId, tx);
    return null;
  }

  drop(transactionId: string): void {
    const tx = this.byId.get(transactionId);
    if (!tx) {
      return;
    }
    this.engine.releaseReservation(tx);
    this.byId.delete(transactionId);
  }

  selectForBlock(limits: BlockResourceLimits = this.engine.limits): ExecutableTransaction[] {
    const ordered = [...this.byId.values()].sort(compareForSelection);
    const selected: ExecutableTransaction[] = [];
    let bytes = 0n;
    let units = 0n;
    let writes = 0n;
    let sigs = 0n;
    for (const tx of ordered) {
      const usage = usageForOperation(tx.operation, tx.encodedBytes, tx.signatureCount);
      const nextBytes = bytes + BigInt(tx.encodedBytes);
      const nextUnits = units + totalUnits(usage);
      const nextWrites = writes + usage.STATE_WRITE_UNITS;
      const nextSigs = sigs + usage.SIGNATURE_VERIFY_UNITS;
      if (
        nextBytes > limits.maxBytes ||
        nextUnits > limits.maxExecutionUnits ||
        nextWrites > limits.maxStateWrites ||
        nextSigs > limits.maxSignatureVerifyUnits
      ) {
        continue;
      }
      selected.push(tx);
      bytes = nextBytes;
      units = nextUnits;
      writes = nextWrites;
      sigs = nextSigs;
    }
    this.engine.metrics.blockResourceUtilization =
      limits.maxExecutionUnits === 0n ? 0n : (units * 10_000n) / limits.maxExecutionUnits;
    return selected;
  }

  removeCommitted(ids: readonly string[]): void {
    for (const id of ids) {
      this.byId.delete(id);
    }
  }

  size(): number {
    return this.byId.size;
  }
}

export function blockFitsLimits(
  txs: readonly ExecutableTransaction[],
  limits: BlockResourceLimits,
): boolean {
  let bytes = 0n;
  let units = 0n;
  let writes = 0n;
  let sigs = 0n;
  for (const tx of txs) {
    const usage = usageForOperation(tx.operation, tx.encodedBytes, tx.signatureCount);
    bytes += BigInt(tx.encodedBytes);
    units += totalUnits(usage);
    writes += usage.STATE_WRITE_UNITS;
    sigs += usage.SIGNATURE_VERIFY_UNITS;
  }
  return (
    bytes <= limits.maxBytes &&
    units <= limits.maxExecutionUnits &&
    writes <= limits.maxStateWrites &&
    sigs <= limits.maxSignatureVerifyUnits
  );
}

export function estimatedPriorityFee(engine: FeeEngine, tx: ExecutableTransaction): bigint {
  return calculateFee(engine.schedule, usageForOperation(tx.operation, tx.encodedBytes, tx.signatureCount));
}
