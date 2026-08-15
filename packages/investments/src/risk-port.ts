import { LIVE_TRADING_ENABLED } from '../../config/src/flags.ts';
import type { InvestmentRiskKernelFacts, ProposedPaperTrade, RiskDecision } from '../../risk/src/types.ts';
import { LIVE_INVESTMENT_EXECUTION, type RiskControlStatus } from './types.ts';
import type { PaperOrder } from './order.ts';

export type RiskControlDecision = {
  readonly status: RiskControlStatus;
  readonly permitted: boolean;
  readonly reason: string;
  readonly assessment?: RiskDecision;
  readonly kernelFacts?: InvestmentRiskKernelFacts;
};

export type PreTradeRiskInput = {
  readonly order: Pick<PaperOrder, 'side' | 'orderType' | 'simulation'>;
  readonly proposed?: ProposedPaperTrade;
  readonly assess?: () => RiskDecision;
};

export interface InvestmentRiskControlPort {
  evaluatePaperOrder(input: PreTradeRiskInput | Pick<PaperOrder, 'side' | 'orderType' | 'simulation'>): RiskControlDecision;
}

function asOrder(
  input: PreTradeRiskInput | Pick<PaperOrder, 'side' | 'orderType' | 'simulation'>,
): Pick<PaperOrder, 'side' | 'orderType' | 'simulation'> {
  return 'order' in input ? input.order : input;
}

export const paperOnlyRiskControl: InvestmentRiskControlPort = {
  evaluatePaperOrder(input) {
    const order = asOrder(input);
    if (LIVE_INVESTMENT_EXECUTION !== false || LIVE_TRADING_ENABLED !== false) {
      return Object.freeze({
        status: 'BLOCKED_LIVE_EXECUTION',
        permitted: false,
        reason: 'LIVE_INVESTMENT_EXECUTION and LIVE_TRADING_ENABLED must remain false',
      });
    }
    if (order.simulation !== true) {
      return Object.freeze({
        status: 'BLOCKED_LIVE_EXECUTION',
        permitted: false,
        reason: 'live orders are forbidden',
      });
    }
    if ('assess' in input && input.assess) {
      const assessment = input.assess();
      const permitted = assessment.outcome === 'ALLOW_SIMULATION';
      return Object.freeze({
        status: permitted ? 'PAPER_SIMULATION_ONLY' : 'RISK_ENGINE_BLOCKED',
        permitted,
        reason: assessment.triggeredLimits[0]?.message ?? assessment.outcome,
        assessment,
        kernelFacts: Object.freeze({
          assessmentId: assessment.assessmentId,
          outcome: assessment.outcome,
          triggeredLimitIds: Object.freeze(assessment.triggeredLimits.map((row) => row.limitId)),
          modelId: String(assessment.modelId),
          modelVersion: String(assessment.modelVersion),
          generatedAt: assessment.generatedAt,
        }),
      });
    }
    return Object.freeze({
      status: 'PAPER_SIMULATION_ONLY',
      permitted: true,
      reason: 'paper simulation structural checks only; attach RiskEngine.assess for pre-trade gating',
    });
  },
};
