import type { Money } from './money.ts';
import type { formatMoney } from './money.ts';

/**
 * A fact the explainer is allowed to mention. Explanations are built only
 * from these records — never from model chain-of-thought.
 */
export type RecordedFactor =
  | {
      readonly key: 'savings_balance';
      readonly amount: Money;
    }
  | {
      readonly key: 'monthly_essential_spending';
      readonly amount: Money;
    }
  | {
      readonly key: 'reserve_months';
      readonly months: bigint;
    }
  | {
      readonly key: 'liquid_floor';
      readonly amount: Money;
    }
  | {
      readonly key: 'surplus';
      readonly amount: Money;
    }
  | {
      readonly key: 'high_cost_debt_name';
      readonly name: string;
    }
  | {
      readonly key: 'high_cost_debt_balance';
      readonly amount: Money;
    }
  | {
      readonly key: 'obligation_name';
      readonly name: string;
    }
  | {
      readonly key: 'obligation_amount';
      readonly amount: Money;
    }
  | {
      readonly key: 'goal_name';
      readonly name: string;
    }
  | {
      readonly key: 'waterfall_step';
      readonly step: string;
    }
  | {
      readonly key: 'mandate_clause';
      readonly clauseId: string;
      readonly sourceText: string;
    }
  | {
      readonly key: 'reason_code';
      readonly code: string;
    }
  | {
      readonly key: 'merchant_name';
      readonly name: string;
    }
  | {
      readonly key: 'subscription_classification';
      readonly classification: string;
    }
  | {
      readonly key: 'sponsor_name';
      readonly name: string;
    }
  | {
      readonly key: 'opportunity_compensation';
      readonly amount: Money;
    }
  | {
      readonly key: 'agreement_present';
      readonly present: boolean;
    }
  | {
      readonly key: 'token_limit';
      readonly amount: Money;
      readonly kind: 'per_transaction' | 'daily';
    }
  | {
      readonly key: 'refusal_reason';
      readonly reason: string;
    };

export type { formatMoney };
