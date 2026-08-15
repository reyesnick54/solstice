import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { CorporateActionId, InstrumentId, InvestmentAccountId } from './ids.ts';
import type { CorporateActionKind } from './types.ts';

export type CorporateAction = {
  readonly corporateActionId: CorporateActionId;
  readonly kind: CorporateActionKind;
  readonly instrumentId: InstrumentId;
  readonly investmentAccountId: InvestmentAccountId | null;
  readonly recordRef: string;
  readonly cashAmount: Money | null;
  readonly currency: string;
  readonly splitNumerator: bigint | null;
  readonly splitDenominator: bigint | null;
  readonly paymentAt: UtcInstant;
  readonly processedAt: UtcInstant | null;
  readonly cashJournalId: string | null;
  readonly simulation: true;
};

export function freezeCorporateAction(action: CorporateAction): CorporateAction {
  if (action.simulation !== true) {
    throw new Error('live corporate-action feeds are not implemented');
  }
  return Object.freeze({ ...action });
}
