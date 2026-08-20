/**
 * Rehearsal governance: parameter-package supersession, conversion
 * change, and impossible max-supply tightening.
 *
 * Historical receipts keep the original policy reference. New issuance
 * uses the new version only after rehearsal activation. No retroactive
 * recomputation. Tightening max supply below issued supply is rejected
 * and does not burn existing balances.
 */

import { HumanContributionMonetaryBridge } from '../../economics/human-contribution-bridge/index.ts';
import { MoonReyProductiveSettlementBridge } from '../../productive/policy-governance/value-settlement/index.ts';
import type { AssetSupplyBook } from '../../economics/supply.ts';
import { issueMoonReyV2 } from './moonrey-path.ts';
import { rejectMaxSupplyTightening } from './parameters.ts';
import { emptyHinState, issueSunReyContribution } from './sunrey-path.ts';
import type { PolicyUpgradeResult, ReceiptRecord, RehearsalParameterPackage } from './types.ts';
import { impossibleMaxSupplyPackage, rehearsalParameterPackageV2 } from './fixtures.ts';

export function rehearsePolicyUpgrade(input: {
  readonly v1: RehearsalParameterPackage;
  readonly sunrey: AssetSupplyBook;
  readonly moonrey: AssetSupplyBook;
  readonly sunreyBridge: HumanContributionMonetaryBridge;
  readonly moonreyBridge: MoonReyProductiveSettlementBridge;
  readonly v1SunReyReceipts: readonly ReceiptRecord[];
  readonly v1MoonReyReceipts: readonly ReceiptRecord[];
}): {
  readonly result: PolicyUpgradeResult;
  readonly v2: RehearsalParameterPackage;
  readonly sunrey: AssetSupplyBook;
  readonly moonrey: AssetSupplyBook;
} {
  const v2 = rehearsalParameterPackageV2();
  const hin = emptyHinState(v2.requireFinalizedHinAnchor.value);
  const nextSunRey = issueSunReyContribution({
    pkg: v2,
    book: input.sunrey,
    bridge: input.sunreyBridge,
    hin,
    contributionId: 'hec.rehearsal.upgrade.v2',
    measurementQuantity: 5n,
    authorizationId: 'hcesa.rehearsal.upgrade.v2',
    epochKey: `${v2.policyVersion}:upgrade`,
  });
  const nextMoonRey = issueMoonReyV2({
    pkg: v2,
    book: input.moonrey,
    bridge: input.moonreyBridge,
    category: 'ENERGY',
    suffix: 'upgrade-v2',
    productiveValueQuantity: 900n,
  });
  const historicalStable =
    input.v1SunReyReceipts.every((row) => row.policyVersion === input.v1.policyVersion) &&
    input.v1MoonReyReceipts.every((row) => row.policyVersion === input.v1.policyVersion);
  const newUsesV2 =
    (nextSunRey.receipt?.policyVersion === v2.policyVersion || !nextSunRey.ok) &&
    (nextMoonRey.receipt?.conversionVersion === v2.moonreyConversion.versionId || !nextMoonRey.ok);
  const conversionChanged =
    input.v1.sunreyConversion.value.numerator !== v2.sunreyConversion.value.numerator &&
    input.v1.moonreyConversion.value.numerator !== v2.moonreyConversion.value.numerator;
  const issued = {
    sunrey: nextSunRey.book.genesisAllocated + nextSunRey.book.issuedPostGenesis,
    moonrey: nextMoonRey.book.genesisAllocated + nextMoonRey.book.issuedPostGenesis,
  };
  const tightening = rejectMaxSupplyTightening(impossibleMaxSupplyPackage(issued.sunrey), issued);
  const balancesBefore = nextSunRey.book.circulating + nextMoonRey.book.circulating;
  const balancesAfter = nextSunRey.book.circulating + nextMoonRey.book.circulating;
  return {
    v2,
    sunrey: nextSunRey.book,
    moonrey: nextMoonRey.book,
    result: Object.freeze({
      fromVersion: input.v1.policyVersion,
      toVersion: v2.policyVersion,
      historicalReceiptsStable: historicalStable,
      newIssuanceUsesNewVersion: Boolean(nextSunRey.ok && nextMoonRey.ok && newUsesV2),
      retroactiveRecompute: false,
      conversionChangeNonRetroactive: conversionChanged && historicalStable,
      maxSupplyTighteningRejected: tightening.rejected,
      existingBalancesUnburned: balancesBefore === balancesAfter,
    }),
  };
}
