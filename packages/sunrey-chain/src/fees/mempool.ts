import { calculateFee } from './schedule.ts';
import { usageForOperation } from './meter.ts';
import { PRIORITY_SCALE, totalUnits, type ExecutableTransaction } from './types.ts';
import type { FeeEngine } from './engine.ts';
import type { BlockResourceLimits, FeeRejection } from './types.ts';
import { developmentAntiSpamControls, mempoolAdmissionBounded, usageV2ForTransaction, weightedUsage } from './v2/index.ts';

/**
 * Deterministic mempool selection:
 * 1. effective fee priority descending
 *    priority = (max_fee * PRIORITY_SCALE) / max(max_execution_units, 1)
 * 2. transaction_id ascending (canonical hex)
 *
 * Local arrival time is not used. Validators that see the same admitted
 * set therefore select the same prefix independently.
 */
export function effectiveFeePriority(tx: ExecutableTransaction, engine?: FeeEngine): bigint {
  if (engine?.policyVersion === 2) {
    const usage = usageV2ForTransaction(tx);
    const units = weightedUsage(usage, engine.feePolicyV2.weights);
    const denom = units === 0n ? 1n : units;
    const authorized = tx.budget.maxFee + (tx.priorityAuthorized === true ? tx.authorizedPriorityFee ?? 0n : 0n);
    return (authorized * PRIORITY_SCALE) / denom;
  }
  const units = tx.budget.maxExecutionUnits === 0n ? 1n : tx.budget.maxExecutionUnits;
  return (tx.budget.maxFee * PRIORITY_SCALE) / units;
}

export function compareForSelection(
  left: ExecutableTransaction,
  right: ExecutableTransaction,
  engine?: FeeEngine,
): number {
  const leftPriority = effectiveFeePriority(left, engine);
  const rightPriority = effectiveFeePriority(right, engine);
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
  private readonly ordered: ExecutableTransaction[] = [];
  private readonly engine: FeeEngine;

  constructor(engine: FeeEngine) {
    this.engine = engine;
  }

  private insertOrdered(tx: ExecutableTransaction): void {
    let lo = 0;
    let hi = this.ordered.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compareForSelection(this.ordered[mid]!, tx, this.engine) <= 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.ordered.splice(lo, 0, tx);
  }

  private removeOrdered(transactionId: string): void {
    const index = this.ordered.findIndex((tx) => tx.transactionId === transactionId);
    if (index >= 0) {
      this.ordered.splice(index, 1);
    }
  }

  admit(tx: ExecutableTransaction): FeeRejection | null {
    if (this.byId.has(tx.transactionId)) {
      return { code: 'INVALID_RESOURCE_DECLARATION', stage: 'mempool', detail: 'duplicate transaction id' };
    }
    if (this.engine.policyVersion === 2) {
      const controls = developmentAntiSpamControls(this.engine.feePolicyV2);
      const actorCount = this.ordered.filter((item) => item.budget.feePayer === tx.budget.feePayer).length;
      const currentBytes = this.ordered.reduce((sum, item) => sum + item.encodedBytes, 0);
      if (!mempoolAdmissionBounded(this.ordered.length, currentBytes, actorCount, tx.encodedBytes, controls)) {
        return { code: 'BLOCK_RESOURCE_LIMIT', stage: 'mempool', detail: 'mempool resource exhaustion is bounded' };
      }
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
    this.insertOrdered(tx);
    return null;
  }

  drop(transactionId: string): void {
    const tx = this.byId.get(transactionId);
    if (!tx) {
      return;
    }
    this.engine.releaseReservation(tx);
    this.byId.delete(transactionId);
    this.removeOrdered(transactionId);
  }

  selectForBlock(limits: BlockResourceLimits = this.engine.limits): ExecutableTransaction[] {
    const ordered = this.ordered;
    const selected: ExecutableTransaction[] = [];
    let bytes = 0n;
    let units = 0n;
    let writes = 0n;
    let sigs = 0n;
    for (const tx of ordered) {
      const usage = usageForOperation(tx.operation, tx.encodedBytes, tx.signatureCount);
      const nextBytes = bytes + BigInt(tx.encodedBytes);
      const nextUnits =
        this.engine.policyVersion === 2
          ? units + weightedUsage(usageV2ForTransaction(tx), this.engine.feePolicyV2.weights)
          : units + totalUnits(usage);
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
      this.removeOrdered(id);
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
