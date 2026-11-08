import type { UtcInstant } from '@solstice/domain';

import type { PaperStrategyRun } from '../../paper.ts';
import { asForwardAlphaCampaignId, asForwardAlphaStrategyId } from '../ids.ts';

export const FORWARD_PAPER_ALPHA01_EVIDENCE_LANE = 'FORWARD_PAPER' as const;

export function paperRunToAlpha01CampaignRef(run: PaperStrategyRun): {
  readonly campaignId: ReturnType<typeof asForwardAlphaCampaignId>;
  readonly strategyId: ReturnType<typeof asForwardAlphaStrategyId>;
  readonly strategyVersion: string;
  readonly primaryLane: typeof FORWARD_PAPER_ALPHA01_EVIDENCE_LANE;
  readonly openedAt: UtcInstant;
} {
  return Object.freeze({
    campaignId: asForwardAlphaCampaignId(`camp_paper_${run.runId}`),
    strategyId: asForwardAlphaStrategyId(run.strategyId),
    strategyVersion: run.strategyVersion,
    primaryLane: FORWARD_PAPER_ALPHA01_EVIDENCE_LANE,
    openedAt: run.startedAt,
  });
}
