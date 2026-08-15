import { LIVE_TRADING_ENABLED } from '../../config/src/flags.ts';
import { LIVE_INVESTMENT_EXECUTION, type RiskControlStatus } from './types.ts';
import type { PaperOrder } from './order.ts';

/**
 * Chunk 20 will implement the canonical investment Risk Engine.
 * Until then only highly constrained PAPER/SIMULATION execution is permitted.
 */
export type RiskControlDecision = {
  readonly status: RiskControlStatus;
  readonly permitted: boolean;
  readonly reason: string;
};

export interface InvestmentRiskControlPort {
  evaluatePaperOrder(order: Pick<PaperOrder, 'side' | 'orderType' | 'simulation'>): RiskControlDecision;
}

export const paperOnlyRiskControl: InvestmentRiskControlPort = {
  evaluatePaperOrder(order) {
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
        reason: 'live orders are forbidden until the Risk Engine exists',
      });
    }
    return Object.freeze({
      status: 'PAPER_SIMULATION_ONLY',
      permitted: true,
      reason: 'Risk Engine is not implemented (Chunk 20); paper simulation only',
    });
  },
};
