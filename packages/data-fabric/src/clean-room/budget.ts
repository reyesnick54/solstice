import type { PersonalDataCategory } from '@solstice/kernel';

export const DEFAULT_PRIVACY_BUDGET_UNITS = 2;
export const UNITS_PER_QUERY = 1;

export type BudgetKey = {
  readonly buyerId: string;
  readonly category: PersonalDataCategory;
};

export class PrivacyBudgetLedger {
  readonly #remaining = new Map<string, number>();
  readonly #consumed = new Map<string, number>();
  readonly #initial: number;

  constructor(initialUnits: number = DEFAULT_PRIVACY_BUDGET_UNITS) {
    this.#initial = initialUnits;
  }

  remaining(key: BudgetKey): number {
    const id = budgetId(key);
    return this.#remaining.get(id) ?? this.#initial;
  }

  consumed(key: BudgetKey): number {
    return this.#consumed.get(budgetId(key)) ?? 0;
  }

  canConsume(key: BudgetKey, units: number = UNITS_PER_QUERY): boolean {
    return this.remaining(key) >= units;
  }

  consume(key: BudgetKey, units: number = UNITS_PER_QUERY): { readonly remaining: number; readonly consumed: number } {
    if (!this.canConsume(key, units)) {
      throw new Error(`privacy budget exhausted for buyer ${key.buyerId} category ${key.category}`);
    }
    const id = budgetId(key);
    const nextRemaining = this.remaining(key) - units;
    const nextConsumed = this.consumed(key) + units;
    this.#remaining.set(id, nextRemaining);
    this.#consumed.set(id, nextConsumed);
    return { remaining: nextRemaining, consumed: nextConsumed };
  }
}

function budgetId(key: BudgetKey): string {
  return `${key.buyerId}:${key.category}`;
}
