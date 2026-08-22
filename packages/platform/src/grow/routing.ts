import type { FinancialProposalType } from './taxonomy.ts';
import type { GrowExecutionDomain } from './taxonomy.ts';

/**
 * Maps approved proposal types to canonical domains.
 * Growth Orchestrator does not call provider APIs.
 */
export function routeProposalType(proposalType: FinancialProposalType): GrowExecutionDomain {
  switch (proposalType) {
    case 'CASH_TRANSFER':
    case 'RECURRING_CONTRIBUTION':
      return 'PAYMENTS';
    case 'FX_CONVERSION':
      return 'FX';
    case 'INVESTMENT_BUY':
    case 'INVESTMENT_SELL':
      return 'INVESTMENT_EXECUTION';
    case 'EXCHANGE_ACTION':
      return 'SUNREY_EXCHANGE';
    default: {
      const exhaustive: never = proposalType;
      return exhaustive;
    }
  }
}

export function intendedActionFor(proposalType: FinancialProposalType): string {
  switch (proposalType) {
    case 'CASH_TRANSFER':
      return 'INTERNAL_TRANSFER';
    case 'FX_CONVERSION':
      return 'EXECUTE_FX_QUOTE';
    case 'INVESTMENT_BUY':
      return 'CREATE_PAPER_ORDER';
    case 'INVESTMENT_SELL':
      return 'CREATE_PAPER_ORDER';
    case 'EXCHANGE_ACTION':
      return 'PLACE_EXCHANGE_ORDER';
    case 'RECURRING_CONTRIBUTION':
      return 'INTERNAL_TRANSFER';
    default: {
      const exhaustive: never = proposalType;
      return exhaustive;
    }
  }
}
