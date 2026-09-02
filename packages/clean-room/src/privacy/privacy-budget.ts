import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED } from '../taxonomy.ts';

export type PrivacyBudgetRecord = {
  readonly budgetId: string;
  readonly datasetId: string;
  readonly purposeId: string;
  readonly queryClass: string;
  readonly analystRef: string;
  readonly serviceRef: string;
  readonly epsilonConsumed: null;
  readonly epsilonLimit: null;
  readonly queriesConsumed: number;
  readonly queryLimit: number;
  readonly policyVersion: string;
  readonly differentialPrivacy: typeof DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED;
  readonly updatedAt: UtcInstant;
};

export type PrivacyBudgetFailure = {
  readonly code: 'PRIVACY_BUDGET_EXHAUSTED' | 'DP_NOT_CONFIGURED';
  readonly message: string;
};

export class PrivacyBudgetLedger {
  readonly #records = new Map<string, PrivacyBudgetRecord>();

  get(budgetId: string): PrivacyBudgetRecord | undefined {
    return this.#records.get(budgetId);
  }

  consume(input: {
    readonly budgetId: string;
    readonly datasetId: string;
    readonly purposeId: string;
    readonly queryClass: string;
    readonly analystRef: string;
    readonly serviceRef: string;
    readonly queryLimit: number;
    readonly policyVersion: string;
    readonly now: UtcInstant;
  }): Result<PrivacyBudgetRecord, PrivacyBudgetFailure> {
    const existing = this.#records.get(input.budgetId);
    const nextQueries = (existing?.queriesConsumed ?? 0) + 1;
    if (nextQueries > input.queryLimit) {
      return err({
        code: 'PRIVACY_BUDGET_EXHAUSTED',
        message: `query budget ${input.queryLimit} exhausted for ${input.budgetId}`,
      });
    }
    const record = Object.freeze({
      budgetId: input.budgetId,
      datasetId: input.datasetId,
      purposeId: input.purposeId,
      queryClass: input.queryClass,
      analystRef: input.analystRef,
      serviceRef: input.serviceRef,
      epsilonConsumed: null,
      epsilonLimit: null,
      queriesConsumed: nextQueries,
      queryLimit: input.queryLimit,
      policyVersion: input.policyVersion,
      differentialPrivacy: DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED,
      updatedAt: input.now,
    });
    this.#records.set(input.budgetId, record);
    return ok(record);
  }
}
