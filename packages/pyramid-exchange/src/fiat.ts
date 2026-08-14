import {
  asAccountId,
  err,
  ok,
  type AccountId,
  type CustomerId,
  type Result,
  Money,
} from '@solstice/domain';
import { applyRational, asRational } from '@solstice/domain';
import { commitJournal, type Journal, type JournalStore } from '@solstice/ledger';
import type { KernelAuthorization } from '@solstice/kernel';
import type { JurisdictionalAssetRegistry } from './registry.ts';
import type { KillSwitchBoard } from './kill-switch.ts';

export const FIAT_BRIDGE_CLASS = 'SIMULATED_FIAT_PYR_CLASS_BRIDGE' as const;

export type FiatConvertOk = {
  readonly journals: readonly Journal[];
  readonly bridge: typeof FIAT_BRIDGE_CLASS;
  readonly pyrOut: Money;
};

export type FiatConvertErr = {
  readonly code: 'FIAT_GATEWAY_DISABLED' | 'KILL_SWITCH' | 'UNBALANCED';
  readonly reasons: readonly string[];
};

/**
 * Simulated fiat-to-PYR conversion through a named, disclosed class bridge.
 * Disabled by default per jurisdiction. Balanced journals both sides.
 */
export function convertFiatToPyr(
  input: {
    readonly journals: JournalStore;
    readonly authorization: KernelAuthorization;
    readonly registry: JurisdictionalAssetRegistry;
    readonly kills: KillSwitchBoard;
    readonly customerId: CustomerId;
    readonly jurisdiction: string;
    readonly fiatAmount: Money;
    readonly customerFiatAccount: AccountId;
    readonly customerPyrAccount: AccountId;
    readonly occurredAt: string;
    readonly intentId: Journal['intentId'];
  },
): Result<FiatConvertOk, FiatConvertErr> {
  if (input.kills.isEngaged('FIAT_GATEWAY') || input.kills.isEngaged('EXCHANGE')) {
    return err({
      code: 'KILL_SWITCH',
      reasons: Object.freeze(['fiat gateway or exchange kill switch is engaged']),
    });
  }
  if (!input.registry.isCapabilityEnabled(input.jurisdiction, 'FIAT_CONVERT')) {
    return err({
      code: 'FIAT_GATEWAY_DISABLED',
      reasons: Object.freeze([
        `fiat gateway is disabled by default in ${input.jurisdiction}; no recorded listing approval enables FIAT_CONVERT`,
      ]),
    });
  }
  const rate = asRational(1n, 1n);
  const pyrMinor = applyRational(input.fiatAmount.minorUnits, rate);
  const pyr = Money.of(pyrMinor, 'PYR');
  const houseFiat = asAccountId(`house_${input.fiatAmount.currency}_nostro`);
  const housePyr = asAccountId('house_PYR_digital');
  const posted = commitJournal(input.journals, input.authorization, {
    intentId: input.intentId,
    memo: `${FIAT_BRIDGE_CLASS} fiat-to-PYR`,
    postedAt: input.occurredAt as Journal['postedAt'],
    lines: [
      { accountId: input.customerFiatAccount, direction: 'CREDIT', amount: input.fiatAmount },
      { accountId: houseFiat, direction: 'DEBIT', amount: input.fiatAmount },
      { accountId: input.customerPyrAccount, direction: 'DEBIT', amount: pyr },
      { accountId: housePyr, direction: 'CREDIT', amount: pyr },
    ],
  });
  if (!posted.ok) {
    return err({ code: 'UNBALANCED', reasons: Object.freeze(['fiat bridge journal did not balance']) });
  }
  return ok({
    journals: Object.freeze([posted.value]),
    bridge: FIAT_BRIDGE_CLASS,
    pyrOut: pyr,
  });
}
