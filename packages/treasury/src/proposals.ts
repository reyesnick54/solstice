import type { Money } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { ForecastId, RebalanceProposalId, TreasuryAccountId } from './ids.ts';
import type { RebalanceState } from './types.ts';

export type TreasuryRebalanceProposal = {
  readonly proposalId: RebalanceProposalId;
  readonly sourceTreasuryAccountId: TreasuryAccountId;
  readonly destinationTreasuryAccountId: TreasuryAccountId;
  readonly amount: Money;
  readonly narrative: string;
  readonly state: RebalanceState;
  readonly executable: false | true;
  readonly authorityId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type ForecastAssumption = {
  readonly key: string;
  readonly value: string;
};

export type CashForecast = {
  readonly forecastId: ForecastId;
  readonly horizonMs: bigint;
  readonly currency: string;
  readonly openingAvailable: Money;
  readonly projectedAvailable: Money;
  readonly pendingInbound: Money;
  readonly pendingOutbound: Money;
  readonly reserved: Money;
  readonly sourceFacts: readonly string[];
  readonly assumptions: readonly ForecastAssumption[];
  readonly version: string;
  readonly generatedAt: UtcInstant;
};

export const FORECAST_VERSION = 'treasury-forecast-v1';

export function freezeProposal(row: TreasuryRebalanceProposal): TreasuryRebalanceProposal {
  if (row.amount.isNegative() || row.amount.isZero()) {
    throw new Error('rebalance amount must be positive');
  }
  return Object.freeze({ ...row });
}

export function freezeForecast(row: CashForecast): CashForecast {
  if (row.openingAvailable.currency !== row.currency) {
    throw new Error('forecast must stay currency-separated');
  }
  return Object.freeze({
    ...row,
    sourceFacts: Object.freeze([...row.sourceFacts]),
    assumptions: Object.freeze([...row.assumptions]),
  });
}
