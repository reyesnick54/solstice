import type { AccountRegister } from '../../ledger/src/accounts.ts';
import type { LedgerAccount } from '../../ledger/src/types.ts';

/**
 * Explicit card settlement books. SYSTEM / SIMULATION ownership only.
 * No unexplained plug accounts.
 */
export const CARD_TREASURY_ACCOUNT_IDS = {
  settlementClearingUsd: 'SIMULATION.CARD_SETTLEMENT_CLEARING.USD',
  processorNetworkUsd: 'SIMULATION.CARD_PROCESSOR_NETWORK.USD',
  feeClearingUsd: 'SIMULATION.CARD_FEE_CLEARING.USD',
  feeIncomeUsd: 'CORPORATE.CARD_FEE_INCOME.USD',
  disputeProvisionalUsd: 'SIMULATION.CARD_DISPUTE_PROVISIONAL.USD',
} as const;

export function registerCardTreasuryBooks(register: AccountRegister): void {
  const books: readonly LedgerAccount[] = [
    sys(CARD_TREASURY_ACCOUNT_IDS.settlementClearingUsd, 'Card settlement clearing USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(CARD_TREASURY_ACCOUNT_IDS.processorNetworkUsd, 'Card processor/network settlement USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(CARD_TREASURY_ACCOUNT_IDS.feeClearingUsd, 'Card fee clearing USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(CARD_TREASURY_ACCOUNT_IDS.feeIncomeUsd, 'Corporate card fee income USD', 'CORPORATE_OPERATING', 'USD'),
    sys(CARD_TREASURY_ACCOUNT_IDS.disputeProvisionalUsd, 'Card dispute provisional USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
  ];
  for (const book of books) {
    register.registerSystemAccount(book);
  }
}

function sys(
  id: string,
  name: string,
  accountClass: LedgerAccount['accountClass'],
  currency: string,
): LedgerAccount {
  return Object.freeze({ id, name, accountClass, currency });
}

export function cardSettlementClearingAccountId(currency: string): string {
  return `SIMULATION.CARD_SETTLEMENT_CLEARING.${currency}`;
}

export function cardProcessorNetworkAccountId(currency: string): string {
  return `SIMULATION.CARD_PROCESSOR_NETWORK.${currency}`;
}

export function cardFeeClearingAccountId(currency: string): string {
  return `SIMULATION.CARD_FEE_CLEARING.${currency}`;
}

export function cardFeeIncomeAccountId(currency: string): string {
  return `CORPORATE.CARD_FEE_INCOME.${currency}`;
}

export function cardDisputeProvisionalAccountId(currency: string): string {
  return `SIMULATION.CARD_DISPUTE_PROVISIONAL.${currency}`;
}
