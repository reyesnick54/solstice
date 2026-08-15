import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asAccountId } from '../../../domain/src/account.ts';
import { asCurrencyCode } from '../../../domain/src/currency.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../../domain/src/legal-entity.ts';
import { asProductId } from '../../../domain/src/product.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import {
  ACTION_TYPES,
  type CreatePaperOrderIntent,
  type InternalTransferIntent,
  type OpenInvestmentAccountIntent,
} from '../../../permissions/src/action-types.ts';
import { asIntentId, PURPOSE_CODES, type ActionIntent } from '../../../permissions/src/action-intent.ts';
import type { GrowthActionCandidate } from './types.ts';

export type MaterializeFailure = {
  readonly code:
    | 'UNSUPPORTED_ACTION'
    | 'INVESTMENT_NOT_IMPLEMENTED'
    | 'NOT_APPROVED'
    | 'MISSING_ACCOUNTS'
    | 'PROHIBITED'
    | 'DEPENDENCY_NOT_IMPLEMENTED';
  readonly message: string;
};

const MATERIALIZABLE = new Set([
  'ALLOCATE_TO_EMERGENCY_RESERVE',
  'MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS',
]);

/**
 * Safe future bridge. Builds a canonical ActionIntent only.
 * Does not submit to the Kernel, post journals, or issue authority.
 */
export function materializeGrowthAction(input: {
  readonly candidate: GrowthActionCandidate;
  readonly approved: boolean;
  readonly actorId: string;
  readonly requestedAt: string;
}): Result<ActionIntent, MaterializeFailure> {
  const candidate = input.candidate;
  if (!input.approved) {
    return err({ code: 'NOT_APPROVED', message: 'ActionIntent materialization requires explicit approval' });
  }
  if (candidate.action === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE') {
    return err({
      code: 'INVESTMENT_NOT_IMPLEMENTED',
      message: 'unsupported investment action cannot materialize an ActionIntent',
    });
  }
  if (candidate.action === 'INVESTMENT_ACCOUNT_AVAILABLE') {
    const openIntent: OpenInvestmentAccountIntent = {
      id: asIntentId(`I-growth-${candidate.actionId}`),
      actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
      payload: {
        accountId: asAccountId(candidate.destinationAccountId ?? candidate.sourceAccountId ?? 'acct_missing'),
        investmentAccountId: `inv_${candidate.actionId}`,
        customerId: asCustomerId(candidate.sourceAccountId ?? 'cust_missing'),
        brokerageCashAccountId: asAccountId(candidate.destinationAccountId ?? 'acct_missing'),
        securitiesAccountId: asAccountId(candidate.destinationAccountId ?? 'acct_missing'),
        pendingSettlementAccountId: asAccountId(candidate.destinationAccountId ?? 'acct_missing'),
        productId: asProductId('prod_brokerage_cash_usd_gb'),
        legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
        jurisdiction: asJurisdiction('GB'),
        currency: asCurrencyCode('USD'),
      },
      idempotencyKey: `growth:${candidate.actionId}`,
      actorId: input.actorId,
      requestedAt: asUtcInstant(input.requestedAt),
      purpose: 'CUSTOMER_INVESTMENT',
    };
    return ok(openIntent);
  }
  if (candidate.action === 'PAPER_INVESTMENT_REVIEW_AVAILABLE') {
    const orderIntent: CreatePaperOrderIntent = {
      id: asIntentId(`I-growth-${candidate.actionId}`),
      actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
      payload: {
        accountId: asAccountId(candidate.sourceAccountId ?? 'acct_missing'),
        investmentAccountId: `inv_${candidate.actionId}`,
        orderId: `ord_${candidate.actionId}`,
        instrumentId: 'SIM-ETF-1',
        side: 'BUY',
        quantityUnits: '0',
        orderType: 'MARKET_SIMULATION',
      },
      idempotencyKey: `growth:${candidate.actionId}`,
      actorId: input.actorId,
      requestedAt: asUtcInstant(input.requestedAt),
      purpose: 'CUSTOMER_INVESTMENT',
    };
    return ok(orderIntent);
  }
  if (
    candidate.executionCapability === 'DEPENDENCY_NOT_IMPLEMENTED' ||
    candidate.executionCapability === 'PROPOSAL_ONLY' ||
    candidate.executionCapability === 'INFORMATION_ONLY' ||
    candidate.executionCapability === 'HUMAN_REVIEW_REQUIRED' ||
    candidate.executionCapability === 'PROHIBITED'
  ) {
    return err({
      code: candidate.executionCapability === 'PROHIBITED' ? 'PROHIBITED' : 'UNSUPPORTED_ACTION',
      message: `execution capability ${candidate.executionCapability} cannot materialize an ActionIntent`,
    });
  }
  if (!MATERIALIZABLE.has(candidate.action)) {
    return err({ code: 'UNSUPPORTED_ACTION', message: `${candidate.action} cannot materialize an ActionIntent` });
  }
  if (!candidate.sourceAccountId || !candidate.destinationAccountId || !candidate.proposedAmount) {
    return err({ code: 'MISSING_ACCOUNTS', message: 'materialization requires two existing eligible accounts and an amount' });
  }
  const amount = Money.fromMinorUnitsString(
    candidate.proposedAmount.minorUnits,
    candidate.proposedAmount.currency,
  );
  const intent: InternalTransferIntent = {
    id: asIntentId(`I-growth-${candidate.actionId}`),
    actionType: ACTION_TYPES.INTERNAL_TRANSFER,
    payload: {
      sourceAccountId: asAccountId(candidate.sourceAccountId),
      destinationAccountId: asAccountId(candidate.destinationAccountId),
      amount,
    },
    idempotencyKey: `growth:${candidate.actionId}`,
    actorId: input.actorId,
    requestedAt: asUtcInstant(input.requestedAt),
    purpose: PURPOSE_CODES[3],
  };
  return ok(intent);
}
