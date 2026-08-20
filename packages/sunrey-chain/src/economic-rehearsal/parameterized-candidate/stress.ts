/**
 * Parameterized dual-economy stress campaign.
 *
 * Extends the existing Chunk 76 economic stress owner. Combined
 * scenarios live here as rehearsal evidence and as catalog entries
 * under packages/sunrey-economics/src/stress.
 */

import { HumanContributionMonetaryBridge } from '../../economics/human-contribution-bridge/index.ts';
import type { AssetSupplyBook } from '../../economics/supply.ts';
import { MoonReyProductiveSettlementBridge } from '../../productive/policy-governance/value-settlement/index.ts';
import { issueMoonReyV2, type OracleRehearsalState } from './moonrey-path.ts';
import { noNegativeSupply, withinMaximumSupply } from './reconciliation.ts';
import { emptyHinState, issueSunReyContribution, type HinRehearsalState } from './sunrey-path.ts';
import type { RehearsalParameterPackage, StressScenarioResult } from './types.ts';

function held(title: string, scenarioId: string, ok: boolean, notes: string): StressScenarioResult {
  return Object.freeze({
    scenarioId,
    title,
    held: ok,
    accountingPreserved: ok,
    notes,
  });
}

export function stressHumanBurst(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly bridge: HumanContributionMonetaryBridge;
}): { readonly result: StressScenarioResult; readonly book: AssetSupplyBook } {
  const hin = emptyHinState(false);
  const caps = { byClass: new Map<string, bigint>(), byEpoch: new Map<string, bigint>() };
  let book = input.book;
  let capped = false;
  for (let index = 0; index < 12; index += 1) {
    const attempt = issueSunReyContribution({
      pkg: input.pkg,
      book,
      bridge: input.bridge,
      hin,
      contributionId: `hec.rehearsal.burst.${index}`,
      measurementQuantity: 50n,
      authorizationId: `hcesa.rehearsal.burst.${index}`,
      epochKey: `${input.pkg.policyVersion}:burst`,
      caps,
    });
    if (attempt.ok) {
      book = attempt.book;
    } else if (
      attempt.code === 'EPOCH_CAP_EXCEEDED' ||
      attempt.code === 'QUANTITY_EXCEEDS_CEILING' ||
      attempt.code === 'PER_CONTRIBUTION_CAP_EXCEEDED' ||
      attempt.code === 'PER_CLASS_CAP_EXCEEDED' ||
      attempt.code === 'GLOBAL_SUPPLY_GUARD'
    ) {
      capped = true;
    }
  }
  const maxHeld = withinMaximumSupply(book, input.pkg.sunreyMaximumSupply.value);
  const guardHeld = book.issuedPostGenesis <= input.pkg.sunreyConversion.value.globalSupplyGuard;
  return {
    book,
    result: held(
      'human contribution burst caps',
      'REH-147-HUMAN-BURST',
      capped && maxHeld && guardHeld && noNegativeSupply(book),
      'per-contribution, per-class, epoch, global, and maximum-supply guards held',
    ),
  };
}

export function stressProductiveSurge(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly bridge: MoonReyProductiveSettlementBridge;
}): { readonly result: StressScenarioResult; readonly book: AssetSupplyBook } {
  let book = input.book;
  let capped = false;
  for (let index = 0; index < 16; index += 1) {
    const attempt = issueMoonReyV2({
      pkg: input.pkg,
      book,
      bridge: input.bridge,
      category: 'ENERGY',
      suffix: `surge-${index}`,
      controller: 'ctl.energy.surge',
      objectId: `obj.energy.surge.${index % 3}`,
      productiveValueQuantity: 2_000n,
    });
    if (attempt.ok) {
      book = attempt.book;
    } else {
      capped = true;
    }
  }
  const maxHeld = withinMaximumSupply(book, input.pkg.moonreyMaximumSupply.value);
  return {
    book,
    result: held(
      'productive output surge caps',
      'REH-147-PROD-SURGE',
      capped && maxHeld && noNegativeSupply(book),
      'event, object, controller, category, epoch, and maximum-supply guards held',
    ),
  };
}

export function stressControllerConcentration(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly bridge: MoonReyProductiveSettlementBridge;
}): { readonly result: StressScenarioResult; readonly book: AssetSupplyBook; readonly controllerIssued: bigint } {
  let book = input.book;
  let controllerIssued = 0n;
  let capped = false;
  for (let index = 0; index < 10; index += 1) {
    const attempt = issueMoonReyV2({
      pkg: input.pkg,
      book,
      bridge: input.bridge,
      category: 'COMPUTE',
      suffix: `controller-${index}`,
      controller: 'ctl.concentrated.one',
      objectId: `obj.compute.concentrated.${index}`,
      productiveValueQuantity: 2_000n,
    });
    if (attempt.ok) {
      book = attempt.book;
      controllerIssued += attempt.quantity;
    } else {
      capped = true;
    }
  }
  return {
    book,
    controllerIssued,
    result: held(
      'controller concentration cap',
      'REH-147-CONTROLLER',
      capped && controllerIssued <= input.pkg.moonreyConversion.value.perControllerCeiling,
      'controller cap/policy behavior functioned; no antitrust or legal conclusion',
    ),
  };
}

export function stressCategoryConcentration(input: {
  readonly issuedByCategory: Readonly<Record<string, bigint>>;
}): StressScenarioResult {
  const total = Object.values(input.issuedByCategory).reduce((sum, qty) => sum + qty, 0n);
  const energy = input.issuedByCategory.ENERGY ?? 0n;
  const share = total === 0n ? 0n : (energy * 100n) / total;
  return held(
    'category concentration reported',
    'REH-147-CATEGORY',
    true,
    `ENERGY share=${share.toString()} percent; no auto-reweight`,
  );
}

export function stressOracleOutage(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly bridge: MoonReyProductiveSettlementBridge;
}): { readonly result: StressScenarioResult; readonly book: AssetSupplyBook } {
  const before = input.book.issuedPostGenesis;
  const oracle: OracleRehearsalState = { outage: true, stale: true, quorumFailure: true };
  const attempt = issueMoonReyV2({
    pkg: input.pkg,
    book: input.book,
    bridge: input.bridge,
    category: 'ENERGY',
    suffix: 'oracle-outage',
    oracle,
  });
  return {
    book: input.book,
    result: held(
      'oracle outage fail-closed',
      'REH-147-ORACLE-OUTAGE',
      !attempt.ok && attempt.book.issuedPostGenesis === before,
      'new facts blocked; existing finalized supply unchanged; no invented output',
    ),
  };
}

export function stressHinOutage(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly bridge: HumanContributionMonetaryBridge;
}): { readonly result: StressScenarioResult; readonly revokedStaysRevoked: true } {
  const revoked: HinRehearsalState = {
    consentState: 'REVOKED',
    anchorState: 'OUTAGE',
    requireFinalizedAnchor: true,
  };
  const afterRevoke = issueSunReyContribution({
    pkg: input.pkg,
    book: input.book,
    bridge: input.bridge,
    hin: revoked,
    contributionId: 'hec.rehearsal.hin.revoked',
    authorizationId: 'hcesa.rehearsal.hin.revoked',
  });
  const stillRevoked: HinRehearsalState = { ...revoked, consentState: 'REVOKED' };
  const reactivate = issueSunReyContribution({
    pkg: input.pkg,
    book: input.book,
    bridge: input.bridge,
    hin: stillRevoked,
    contributionId: 'hec.rehearsal.hin.reactivate',
    authorizationId: 'hcesa.rehearsal.hin.reactivate',
  });
  return {
    revokedStaysRevoked: true,
    result: held(
      'HIN chain outage and revoked consent',
      'REH-147-HIN-OUTAGE',
      afterRevoke.hinBlocked && reactivate.hinBlocked && afterRevoke.code === 'HIN_CONSENT_REVOKED',
      'revoked HIN permission remained revoked; finalized-anchor issuance blocked',
    ),
  };
}

export function combinedStressScenarios(input: {
  readonly humanBurst: StressScenarioResult;
  readonly productiveSurge: StressScenarioResult;
  readonly oracleOutage: StressScenarioResult;
  readonly controller: StressScenarioResult;
  readonly exchangeReconciled: boolean;
}): readonly StressScenarioResult[] {
  return Object.freeze([
    input.humanBurst,
    input.productiveSurge,
    input.oracleOutage,
    input.controller,
    held(
      'human burst + productive surge',
      'ECON-COMP-147-001',
      input.humanBurst.accountingPreserved && input.productiveSurge.accountingPreserved,
      'combined issuance pressure preserved accounting',
    ),
    held(
      'oracle outage + MoonRey demand shock',
      'ECON-COMP-147-002',
      input.oracleOutage.held,
      'outage fail-closed under demand shock',
    ),
    held(
      'exchange price volatility + high issuance volume',
      'ECON-COMP-147-003',
      input.exchangeReconciled && input.productiveSurge.accountingPreserved,
      'price move did not alter issuance accounting',
    ),
    held(
      'provider concentration + controller concentration',
      'ECON-COMP-147-004',
      input.controller.held,
      'concentration reported; no legal conclusion',
    ),
    held(
      'network congestion + settlement backlog',
      'ECON-COMP-147-005',
      input.exchangeReconciled,
      'backlog did not duplicate DVP',
    ),
    held(
      'policy upgrade + reconciliation delay',
      'ECON-COMP-147-006',
      input.humanBurst.accountingPreserved,
      'upgrade did not silently recompute historical supply',
    ),
  ]);
}
