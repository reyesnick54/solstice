import type { UtcInstant } from '@solstice/domain';

import { PORTFOLIO_RUNTIME_POSTURE } from './types.ts';
import { PortfolioRuntimeBase, type PortfolioRuntimeOptions } from './runtime-base.ts';
import type { ImmutableDailyPortfolioSnapshot, PortfolioRuntimeState } from './types.ts';

export type PaperPortfolioRuntimeOptions = Omit<PortfolioRuntimeOptions, 'mode' | 'posture'>;

export class PaperPortfolioRuntime extends PortfolioRuntimeBase {
  constructor(options: PaperPortfolioRuntimeOptions) {
    super({
      ...options,
      mode: 'PAPER',
      posture: PORTFOLIO_RUNTIME_POSTURE,
    });
  }

  tickPaper(at: UtcInstant): PortfolioRuntimeState {
    const state = this.tick(at);
    if (state.posture.liveBroker) {
      throw new Error('paper runtime must not connect live broker');
    }
    return state;
  }

  closePaperSession(tradingDay: string, sealedAt: UtcInstant): ImmutableDailyPortfolioSnapshot {
    const snapshot = this.closeSession(tradingDay, sealedAt);
    if (snapshot.fills.some((row) => row.externalBrokerSubmitted)) {
      throw new Error('external broker submission detected');
    }
    return snapshot;
  }
}
