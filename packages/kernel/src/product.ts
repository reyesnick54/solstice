import type { ActionKind } from './action-intent.ts';
import type { ProductName } from './policy/schema.ts';

export function productForKind(
  kind: ActionKind,
  sourceCountry: string,
  destinationCountry: string | undefined,
): ProductName {
  switch (kind) {
    case 'CREATE_CUSTOMER':
    case 'TRANSITION_CUSTOMER_STATUS':
      return 'CUSTOMER_LIFECYCLE';
    case 'OPEN_ACCOUNT':
      return 'OPEN_ACCOUNT';
    case 'SEED_CREDIT':
      return 'SEED_CREDIT';
    case 'ADD_BENEFICIARY':
    case 'UPDATE_BENEFICIARY':
      return 'ADD_BENEFICIARY';
    case 'FX_CONVERT':
      return 'FX_CONVERSION';
    case 'POST_JOURNAL':
      return 'SEED_CREDIT';
    case 'RECORD_COST_AVOIDED':
      return 'COST_AVOIDED';
    case 'COMPENSATE_PAYMENT':
    case 'SEND_PAYMENT': {
      const dest = destinationCountry ?? sourceCountry;
      return dest === sourceCountry ? 'DOMESTIC_PAYMENT' : 'CROSS_BORDER_PAYMENT';
    }
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function currencyHintForKind(kind: ActionKind, payload: unknown): string {
  if (kind === 'SEND_PAYMENT') {
    const instructed = (payload as { instructedAmount?: { currency?: string } }).instructedAmount;
    return instructed?.currency ?? 'USD';
  }
  if (kind === 'SEED_CREDIT' || kind === 'FX_CONVERT') {
    const amount = (payload as { amount?: { currency?: string }; sourceAmount?: { currency?: string } })
      .amount ?? (payload as { sourceAmount?: { currency?: string } }).sourceAmount;
    return amount?.currency ?? 'USD';
  }
  if (kind === 'ADD_BENEFICIARY') {
    return (payload as { currency?: string }).currency ?? 'USD';
  }
  return 'USD';
}
