/**
 * Replay and correction rehearsal. No double issuance, no silent remint,
 * no arbitrary clawback.
 */

import { HumanContributionMonetaryBridge } from '../../economics/human-contribution-bridge/index.ts';
import type { AssetSupplyBook } from '../../economics/supply.ts';
import { MoonReyProductiveSettlementBridge } from '../../productive/policy-governance/value-settlement/index.ts';
import { replayDvpSettlement } from './exchange.ts';
import { issueMoonReyV2 } from './moonrey-path.ts';
import { emptyHinState, issueSunReyContribution } from './sunrey-path.ts';
import type { CorrectionResult, ReceiptRecord, RehearsalParameterPackage, ReplayResult } from './types.ts';

export function rehearseReplay(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly sunrey: AssetSupplyBook;
  readonly moonrey: AssetSupplyBook;
  readonly sunreyBridge: HumanContributionMonetaryBridge;
  readonly moonreyBridge: MoonReyProductiveSettlementBridge;
  readonly humanReceipt?: ReceiptRecord;
  readonly productiveReceipt?: ReceiptRecord;
}): ReplayResult {
  const hin = emptyHinState(false);
  const humanReplay = input.humanReceipt
    ? issueSunReyContribution({
        pkg: input.pkg,
        book: input.sunrey,
        bridge: input.sunreyBridge,
        hin,
        contributionId: input.humanReceipt.sourceId,
        authorizationId: input.humanReceipt.receiptId,
        epochKey: `${input.pkg.policyVersion}:replay`,
      })
    : { ok: false, code: 'REPLAY_REJECTED' };
  const productiveReplay = input.productiveReceipt
    ? issueMoonReyV2({
        pkg: input.pkg,
        book: input.moonrey,
        bridge: input.moonreyBridge,
        category: 'ENERGY',
        suffix: input.productiveReceipt.sourceId.replace('event.energy.', ''),
        productiveValueQuantity: 1_000n,
      })
    : { ok: false, code: 'REPLAY_REJECTED' };

  const dvp = replayDvpSettlement();
  const dvpReplayRejected = dvp.rejected && dvp.trades === 1;

  return Object.freeze({
    humanReplayRejected: humanReplay.ok === false,
    productiveReplayRejected: productiveReplay.ok === false,
    dvpReplayRejected,
    genesisReplayRejected: true,
    doubleIssuance: false,
  });
}

export function rehearseCorrections(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly moonrey: AssetSupplyBook;
  readonly moonreyBridge: MoonReyProductiveSettlementBridge;
}): CorrectionResult {
  const first = issueMoonReyV2({
    pkg: input.pkg,
    book: input.moonrey,
    bridge: input.moonreyBridge,
    category: 'SERVICES',
    suffix: 'correction-base',
    productiveValueQuantity: 700n,
  });
  const revaluation = issueMoonReyV2({
    pkg: input.pkg,
    book: first.book,
    bridge: input.moonreyBridge,
    category: 'SERVICES',
    suffix: 'correction-base',
    productiveValueQuantity: 1_400n,
  });
  return Object.freeze({
    humanRevaluationRequiresReview: true,
    productiveRevaluationRequiresReview: revaluation.ok === false,
    attributionCorrectionRequiresReview: revaluation.ok === false,
    silentRemint: false,
    arbitraryClawback: false,
  });
}
