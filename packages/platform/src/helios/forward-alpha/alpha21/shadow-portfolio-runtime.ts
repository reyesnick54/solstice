import type { UtcInstant } from '@solstice/domain';

import { PORTFOLIO_RUNTIME_POSTURE } from './types.ts';
import { PortfolioRuntimeBase, type PortfolioRuntimeOptions } from './runtime-base.ts';
import type { PortfolioRuntimeState } from './types.ts';

export type ShadowPortfolioRuntimeOptions = Omit<PortfolioRuntimeOptions, 'mode' | 'posture'>;

export class ShadowPortfolioRuntime extends PortfolioRuntimeBase {
  constructor(options: ShadowPortfolioRuntimeOptions) {
    super({
      ...options,
      mode: 'SHADOW',
      posture: PORTFOLIO_RUNTIME_POSTURE,
    });
  }

  tickShadow(at: UtcInstant): PortfolioRuntimeState {
    const state = this.tick(at);
    if (state.posture.financialEffectCreated || state.posture.liveBroker || state.posture.customerMoneyUsed) {
      throw new Error('shadow runtime posture violated');
    }
    return state;
  }
}
