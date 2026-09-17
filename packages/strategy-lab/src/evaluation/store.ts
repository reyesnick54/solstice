import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { StrategyEvaluationRecord } from './record.ts';
import type { EvaluationFailure, EvaluationRunKind } from './types.ts';

export type EvaluationRecordStore = {
  readonly records: readonly StrategyEvaluationRecord[];
  readonly officialQualificationHistory: readonly StrategyEvaluationRecord[];
};

export class ChronologicalEvaluationStore {
  private readonly records = new Map<string, StrategyEvaluationRecord>();
  private readonly byCustomer = new Map<string, StrategyEvaluationRecord[]>();
  private readonly officialByCapsule = new Map<string, StrategyEvaluationRecord[]>();

  persist(record: StrategyEvaluationRecord): Result<StrategyEvaluationRecord, EvaluationFailure> {
    if (this.records.has(record.evaluationId)) {
      return ok(record);
    }
    this.records.set(record.evaluationId, record);
    if (record.customerId) {
      const list = this.byCustomer.get(record.customerId) ?? [];
      list.push(record);
      this.byCustomer.set(record.customerId, list);
    }
    if (record.runKind === 'OFFICIAL_QUALIFICATION') {
      const key = `${record.capsuleFingerprint}:${record.datasetManifestHash}`;
      const list = this.officialByCapsule.get(key) ?? [];
      list.push(record);
      this.officialByCapsule.set(key, list);
    }
    return ok(record);
  }

  get(evaluationId: string): StrategyEvaluationRecord | undefined {
    return this.records.get(evaluationId);
  }

  listForCustomer(customerId: string): readonly StrategyEvaluationRecord[] {
    return Object.freeze([...(this.byCustomer.get(customerId) ?? [])]);
  }

  officialHistory(capsuleFingerprint: string, manifestHash: string): readonly StrategyEvaluationRecord[] {
    return Object.freeze([...(this.officialByCapsule.get(`${capsuleFingerprint}:${manifestHash}`) ?? [])]);
  }

  snapshot(): EvaluationRecordStore {
    const all = Object.freeze([...this.records.values()]);
    const official = Object.freeze(all.filter((row) => row.runKind === 'OFFICIAL_QUALIFICATION'));
    return Object.freeze({ records: all, officialQualificationHistory: official });
  }

  refuseDelete(): Result<never, EvaluationFailure> {
    return err({
      code: 'EVALUATION_DELETE_FORBIDDEN',
      message: 'evaluation records are immutable and must not be deleted',
    });
  }

  countByRunKind(runKind: EvaluationRunKind): number {
    return [...this.records.values()].filter((row) => row.runKind === runKind).length;
  }
}
