import type { Clock } from '../../../packages/config/src/clock.ts';
import type { Account } from '../../../packages/domain/src/account.ts';
import { isErr } from '../../../packages/domain/src/result.ts';
import { Money } from '../../../packages/money/src/money.ts';
import type { CardHoldGateway } from '../../../packages/cards/src/service.ts';
import { projectBankingPosition } from '../../accounts/src/available-funds.ts';
import type { BankingOperationsService } from '../../accounts/src/banking-operations.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';

/**
 * Adapts the canonical banking hold service. Cards never create a second
 * hold implementation and never let the processor call this directly.
 */
export function createCardHoldGateway(
  banking: BankingOperationsService,
  ledger: Ledger,
  clock: Clock,
): CardHoldGateway {
  return {
    createHold: (intent) => banking.createHold(intent),
    releaseHold: (intent) => banking.releaseHold(intent),
    captureHold: (intent) => banking.captureHold(intent),
    cancelHold: (intent) => banking.cancelHold(intent),
    projectAvailable(account: Account) {
      const position = projectBankingPosition(ledger, account, banking.holds, clock.now());
      if (isErr(position)) {
        const zero = Money.zero(account.currency);
        return { available: zero, settled: zero, held: zero };
      }
      return {
        available: position.value.available,
        settled: position.value.settled,
        held: position.value.held,
      };
    },
  };
}
