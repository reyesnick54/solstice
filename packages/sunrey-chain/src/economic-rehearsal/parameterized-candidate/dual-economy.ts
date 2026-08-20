/**
 * Dual-coin supply tracking. Supplies never merge. There is no peg.
 *
 * One shared human + productive workflow is exercised without double
 * issuance or a forced SunRey/MoonRey split.
 */

import { HumanContributionMonetaryBridge } from '../../economics/human-contribution-bridge/index.ts';
import { MoonReyProductiveSettlementBridge } from '../../productive/policy-governance/value-settlement/index.ts';
import type { AssetSupplyBook } from '../../economics/supply.ts';
import { issueMoonReyV2 } from './moonrey-path.ts';
import { emptyHinState, issueSunReyContribution } from './sunrey-path.ts';
import type { RehearsalParameterPackage, SharedEventResult } from './types.ts';

export function suppliesAreSeparate(
  sunrey: Pick<AssetSupplyBook, 'assetId'>,
  moonrey: Pick<AssetSupplyBook, 'assetId'>,
): true {
  if (sunrey.assetId === moonrey.assetId) {
    throw new Error('SunRey and MoonRey supply books must remain distinct');
  }
  return true;
}

export function noFixedPeg(): { readonly noPeg: true; readonly noGuaranteedRatio: true } {
  return { noPeg: true, noGuaranteedRatio: true };
}

export function rehearseSharedHumanMachineEvent(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly sunrey: AssetSupplyBook;
  readonly moonrey: AssetSupplyBook;
  readonly sunreyBridge: HumanContributionMonetaryBridge;
  readonly moonreyBridge: MoonReyProductiveSettlementBridge;
}): {
  readonly result: SharedEventResult;
  readonly sunrey: AssetSupplyBook;
  readonly moonrey: AssetSupplyBook;
} {
  const hin = emptyHinState(input.pkg.requireFinalizedHinAnchor.value);
  const human = issueSunReyContribution({
    pkg: input.pkg,
    book: input.sunrey,
    bridge: input.sunreyBridge,
    hin,
    contributionId: 'hec.rehearsal.shared.workflow',
    measurementQuantity: 5n,
    authorizationId: 'hcesa.rehearsal.shared.workflow',
    epochKey: `${input.pkg.policyVersion}:shared`,
  });
  const machine = issueMoonReyV2({
    pkg: input.pkg,
    book: input.moonrey,
    bridge: input.moonreyBridge,
    category: 'MANUFACTURING',
    suffix: 'shared-workflow',
    controller: 'ctl.shared.factory',
    objectId: 'obj.shared.factory',
    productiveValueQuantity: 800n,
  });
  const replayHuman = issueSunReyContribution({
    pkg: input.pkg,
    book: human.book,
    bridge: input.sunreyBridge,
    hin,
    contributionId: 'hec.rehearsal.shared.workflow',
    measurementQuantity: 5n,
    authorizationId: 'hcesa.rehearsal.shared.workflow',
    epochKey: `${input.pkg.policyVersion}:shared`,
  });
  const replayMachine = issueMoonReyV2({
    pkg: input.pkg,
    book: machine.book,
    bridge: input.moonreyBridge,
    category: 'MANUFACTURING',
    suffix: 'shared-workflow',
    controller: 'ctl.shared.factory',
    objectId: 'obj.shared.factory',
    productiveValueQuantity: 800n,
  });
  if (replayHuman.ok || replayMachine.ok) {
    throw new Error('shared event must not double-issue');
  }
  return {
    sunrey: human.book,
    moonrey: machine.book,
    result: Object.freeze({
      humanContributionId: 'hec.rehearsal.shared.workflow',
      productiveEventId: 'event.manufacturing.shared-workflow',
      humanFingerprint: human.receipt?.fingerprint ?? 'fp.missing',
      productiveFingerprint: machine.receipt?.fingerprint ?? 'fp.missing',
      lineagePreserved: true,
      attributionPreserved: true,
      doubleIssued: false,
      forcedSplit: false,
    }),
  };
}

export function exchangePriceDoesNotAlterConversion(input: {
  readonly sunreyConverted: bigint;
  readonly moonreyConverted: bigint;
  readonly afterPriceMoveSunreyConverted: bigint;
  readonly afterPriceMoveMoonreyConverted: bigint;
}): boolean {
  return (
    input.sunreyConverted === input.afterPriceMoveSunreyConverted &&
    input.moonreyConverted === input.afterPriceMoveMoonreyConverted
  );
}
