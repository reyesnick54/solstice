import { RESIDUAL_CASH_FLOW_RESEARCH_DISCLAIMER } from './taxonomy.ts';
import type { ResidualCashFlowInput, ResidualCashFlowState } from './types.ts';
import { VAL07_RATE_BPS_SCALE } from './taxonomy.ts';

/**
 * Experimental residual operating cash flow family — not canonical RIV.
 */
export function computeResidualCashFlowState(input: ResidualCashFlowInput): ResidualCashFlowState {
  const capitalCharge = (input.waccBps / VAL07_RATE_BPS_SCALE) * input.investedCapital;
  return Object.freeze({
    periodIndex: input.periodIndex,
    operatingCashFlow: input.operatingCashFlow,
    capitalCharge,
    residualOperatingCashFlow: input.operatingCashFlow - capitalCharge,
    experimentalDisclaimer: RESIDUAL_CASH_FLOW_RESEARCH_DISCLAIMER,
  });
}
