/**
 * Orchestrate the parameterized dual-economy rehearsal.
 *
 * Rehearsal Parameter Package
 *   → production validators
 *   → SunRey + MoonRey candidate policies
 *   → economic rehearsal
 *   → supply / issuance / exchange / stress
 *   → reconciliation
 *   → Chunk 143 firewall
 *   → STILL BLOCKED FOR PRODUCTION
 */

import { convertReferenceToSunRey, simulationConversionPolicy as sunreyConversion } from '../../economics/human-contribution-bridge/index.ts';
import { convertGpuvToMoonRey, simulationConversionPolicy as moonreyConversion } from '../../productive/policy-governance/value-settlement/index.ts';
import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../../../../config/src/flags.ts';
import { rehearseSharedHumanMachineEvent, suppliesAreSeparate } from './dual-economy.ts';
import { rehearseCanonicalExchange } from './exchange.ts';
import { evaluateFirewallAfterRehearsal, evaluateFirewallBeforeRehearsal, fixtureBlocked } from './firewall.ts';
import { rehearsalParameterPackageV1 } from './fixtures.ts';
import { rehearsePolicyUpgrade } from './governance.ts';
import { applyMoonReyGenesis, emptyMoonReyBook, rehearseMoonReyPath } from './moonrey-path.ts';
import { validateRehearsalParameterPackage } from './parameters.ts';
import { reconcileEpoch, snapshotPair, viewOf } from './reconciliation.ts';
import { rehearseCorrections, rehearseReplay } from './replay.ts';
import { buildParameterizedDualEconomyRehearsalReport } from './report.ts';
import {
  combinedStressScenarios,
  stressCategoryConcentration,
  stressControllerConcentration,
  stressHinOutage,
  stressHumanBurst,
  stressOracleOutage,
  stressProductiveSurge,
} from './stress.ts';
import { applySunReyGenesis, emptySunReyBook, rehearseSunReyPath } from './sunrey-path.ts';
import type { ParameterizedDualEconomyRehearsalReport } from '../types.ts';

export function runParameterizedDualEconomyRehearsal(): ParameterizedDualEconomyRehearsalReport {
  if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED) {
    throw new Error('parameterized rehearsal refuses to run outside simulation');
  }
  const firewallBefore = evaluateFirewallBeforeRehearsal();
  const pkg = rehearsalParameterPackageV1();
  const validated = validateRehearsalParameterPackage(pkg);
  if (!validated.ok) {
    throw new Error(`rehearsal parameter package failed production validators: ${validated.refusals.join(',')}`);
  }

  const sunreyGenesis = applySunReyGenesis(pkg, emptySunReyBook());
  const moonreyGenesis = applyMoonReyGenesis(pkg, emptyMoonReyBook());
  suppliesAreSeparate(sunreyGenesis.book, moonreyGenesis.book);

  const epoch0 = reconcileEpoch(0, sunreyGenesis.book, moonreyGenesis.book);
  const sunreyPath = rehearseSunReyPath({ pkg, book: sunreyGenesis.book });
  const moonreyPath = rehearseMoonReyPath({ pkg, book: moonreyGenesis.book });
  const epoch1 = reconcileEpoch(1, sunreyPath.book, moonreyPath.book);

  const shared = rehearseSharedHumanMachineEvent({
    pkg,
    sunrey: sunreyPath.book,
    moonrey: moonreyPath.book,
    sunreyBridge: sunreyPath.bridge,
    moonreyBridge: moonreyPath.bridge,
  });
  const exchange = rehearseCanonicalExchange();

  const beforePriceSunRey = convertReferenceToSunRey(
    500n,
    sunreyConversion({
      conversionNumerator: pkg.sunreyConversion.value.numerator,
      conversionDenominator: pkg.sunreyConversion.value.denominator,
    }),
  );
  const beforePriceMoonRey = convertGpuvToMoonRey(
    1_000n,
    moonreyConversion({
      conversionNumerator: pkg.moonreyConversion.value.numerator,
      conversionDenominator: pkg.moonreyConversion.value.denominator,
    }),
  );
  const afterPriceSunRey = convertReferenceToSunRey(
    500n,
    sunreyConversion({
      conversionNumerator: pkg.sunreyConversion.value.numerator,
      conversionDenominator: pkg.sunreyConversion.value.denominator,
    }),
  );
  const afterPriceMoonRey = convertGpuvToMoonRey(
    1_000n,
    moonreyConversion({
      conversionNumerator: pkg.moonreyConversion.value.numerator,
      conversionDenominator: pkg.moonreyConversion.value.denominator,
    }),
  );
  if (beforePriceSunRey !== afterPriceSunRey || beforePriceMoonRey !== afterPriceMoonRey) {
    throw new Error('exchange price must not alter conversion');
  }

  const burst = stressHumanBurst({ pkg, book: shared.sunrey, bridge: sunreyPath.bridge });
  const surge = stressProductiveSurge({ pkg, book: shared.moonrey, bridge: moonreyPath.bridge });
  const controller = stressControllerConcentration({
    pkg,
    book: surge.book,
    bridge: moonreyPath.bridge,
  });
  const oracle = stressOracleOutage({ pkg, book: controller.book, bridge: moonreyPath.bridge });
  const hin = stressHinOutage({ pkg, book: burst.book, bridge: sunreyPath.bridge });
  const category = stressCategoryConcentration({
    issuedByCategory: moonreyPath.result.categoryConcentration,
  });
  const upgrade = rehearsePolicyUpgrade({
    v1: pkg,
    sunrey: burst.book,
    moonrey: oracle.book,
    sunreyBridge: sunreyPath.bridge,
    moonreyBridge: moonreyPath.bridge,
    v1SunReyReceipts: sunreyPath.result.receipts,
    v1MoonReyReceipts: moonreyPath.result.receipts,
  });
  const replay = rehearseReplay({
    pkg,
    sunrey: upgrade.sunrey,
    moonrey: upgrade.moonrey,
    sunreyBridge: sunreyPath.bridge,
    moonreyBridge: moonreyPath.bridge,
    humanReceipt: sunreyPath.result.receipts[0],
    productiveReceipt: moonreyPath.result.receipts[0],
  });
  const corrections = rehearseCorrections({
    pkg,
    moonrey: upgrade.moonrey,
    moonreyBridge: moonreyPath.bridge,
  });
  const epoch2 = reconcileEpoch(2, upgrade.sunrey, upgrade.moonrey);
  const stressScenarios = [
    ...combinedStressScenarios({
      humanBurst: burst.result,
      productiveSurge: surge.result,
      oracleOutage: oracle.result,
      controller: controller.result,
      exchangeReconciled: exchange.reconciled,
    }),
    category,
    hin.result,
  ];
  const firewallAfter = evaluateFirewallAfterRehearsal(pkg);
  if (firewallAfter.productionActivated || !fixtureBlocked(firewallAfter)) {
    throw new Error('fixture package must remain production-blocked by the firewall');
  }
  const sunreyView = viewOf(upgrade.sunrey);
  const moonreyView = viewOf(upgrade.moonrey);
  return buildParameterizedDualEconomyRehearsalReport({
    parameterPackageHash: validated.packageHash,
    sunreyPolicyHash: validated.sunreyPolicyHash,
    moonreyPolicyHash: validated.moonreyPolicyHash,
    sunreyIssued: sunreyView.issued,
    moonreyIssued: moonreyView.issued,
    sunreySupply: sunreyView,
    moonreySupply: moonreyView,
    sunreySupplyReconciled: sunreyView.reconciled,
    moonreySupplyReconciled: moonreyView.reconciled,
    exchangeReconciled: exchange.reconciled,
    epochReconciliations: Object.freeze([
      { epoch: epoch0.epoch, sunreyReconciled: epoch0.sunreyReconciled, moonreyReconciled: epoch0.moonreyReconciled },
      { epoch: epoch1.epoch, sunreyReconciled: epoch1.sunreyReconciled, moonreyReconciled: epoch1.moonreyReconciled },
      { epoch: epoch2.epoch, sunreyReconciled: epoch2.sunreyReconciled, moonreyReconciled: epoch2.moonreyReconciled },
    ]),
    stressScenarios,
    stressFailures: Object.freeze(stressScenarios.filter((row) => !row.held).map((row) => row.scenarioId)),
    policyUpgradeResults: upgrade.result,
    replayResults: replay,
    correctionResults: corrections,
    firewallBefore,
    firewallAfter,
    usedValidators: validated.usedValidators,
    sunreyPathComplete: sunreyPath.result.complete,
    moonreyV2PathComplete: moonreyPath.result.complete,
    suppliesReconciled: sunreyView.reconciled && moonreyView.reconciled && epoch0.sunreyReconciled && epoch1.sunreyReconciled && epoch2.sunreyReconciled,
    snapshots: snapshotPair(upgrade.sunrey, upgrade.moonrey),
  });
}
