import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, SIMULATION_MODE } from '../../../config/src/flags.ts';
import { runEconomicsCommand } from '../cli.ts';
import { listScenarioIds, loadScenario } from '../scenarios.ts';
import { simulateScenario } from '../engine.ts';
import { runAccessEconomyCommand } from './cli.ts';
import { ACCESS_ECONOMY_CATALOG, accessCatalogComplete, accessScenarioById, accessScenarioIds } from './catalog.ts';
import { buildCapacityPools, buildRequests, macroReport } from './capacity.ts';
import { AccessSimulationEvidence, assertSealablePayload } from './evidence.ts';
import { executeAccessScenario, runAccessEconomyScenario } from './engine.ts';
import {
  ACCESS_ECONOMY_INVARIANT_IDS,
  ACCESS_FABRIC_QUALIFICATION_STATE,
  ACCESS_SIM_SCENARIO_IDS,
  FORBIDDEN_ACCESS_ASSET_TOKENS,
} from './ids.ts';
import { ACCESS_INVARIANT_STATEMENTS } from './invariants.ts';
import { qualifyAccessEconomy, renderAccessQualification } from './qualification.ts';

const MACRO_SCENARIOS = ['post-scarcity-abundance', 'human-access-demand-surge', 'productive-capacity-collapse'];

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

describe('ACCESS-13 Access Economy simulation catalog', () => {
  it('extends the dual-economy catalog with abundance, demand, and productivity shocks', () => {
    for (const id of MACRO_SCENARIOS) {
      assert.equal(listScenarioIds().includes(id), true, `missing macro scenario ${id}`);
      const scenario = loadScenario(id);
      assert.equal(scenario.policies.becomesProductionPolicy, false);
      assert.equal(scenario.simulationLabel, 'SIMULATION');
    }
    const abundance = simulateScenario('post-scarcity-abundance', { epochs: 2, seed: 9101 });
    const collapse = simulateScenario('productive-capacity-collapse', { epochs: 2, seed: 9101 });
    assert.equal(abundance.productive.totalOutput > collapse.productive.totalOutput, true);
    assert.equal(abundance.automation.intensityIndex > collapse.automation.intensityIndex, true);
  });

  it('declares exactly the eighteen required access scenarios', () => {
    assert.equal(accessCatalogComplete(), true);
    assert.deepEqual(accessScenarioIds(), [...ACCESS_SIM_SCENARIO_IDS]);
    assert.equal(new Set(ACCESS_ECONOMY_CATALOG.map((row) => row.macroScenarioId)).size >= 5, true);
  });

  it('pins every scenario to a real dual-economy macro scenario', () => {
    for (const scenario of ACCESS_ECONOMY_CATALOG) {
      assert.equal(
        listScenarioIds().includes(scenario.macroScenarioId),
        true,
        `${scenario.scenarioId} points at unknown macro scenario ${scenario.macroScenarioId}`,
      );
    }
  });
});

describe('ACCESS-13 Access Economy scenario behaviour', () => {
  it('is deterministic in scenario id and seed', () => {
    const left = runAccessEconomyScenario('ACCESS-SIM-02-demand-surge');
    const right = runAccessEconomyScenario('ACCESS-SIM-02-demand-surge');
    assert.equal(left.resultDigestSha256, right.resultDigestSha256);
    assert.equal(left.inputFixtureSha256, right.inputFixtureSha256);
    assert.equal(left.evidence.headRecordSha256, right.evidence.headRecordSha256);
    assert.deepEqual(left.outcomeCounts, right.outcomeCounts);
  });

  it('changes its result when the seed changes', () => {
    const base = runAccessEconomyScenario('ACCESS-SIM-02-demand-surge');
    const reseeded = runAccessEconomyScenario('ACCESS-SIM-02-demand-surge', { seed: 424_242 });
    assert.notEqual(base.inputFixtureSha256, reseeded.inputFixtureSha256);
  });

  it('reaches the scarcity mode and the outcomes each scenario is written to exercise', () => {
    for (const scenario of ACCESS_ECONOMY_CATALOG) {
      const result = executeAccessScenario(scenario);
      assert.equal(
        result.scarcityMode,
        scenario.expectedScarcityMode,
        `${scenario.scenarioId} expected ${scenario.expectedScarcityMode} but observed ${result.scarcityMode}`,
      );
      assert.equal(result.expectedOutcomesObserved, true, `${scenario.scenarioId} missed an expected outcome`);
    }
  });

  it('expands access under abundance without granting more than policy allows', () => {
    const abundance = runAccessEconomyScenario('ACCESS-SIM-01-abundance');
    assert.equal(abundance.scarcityMode, 'ABUNDANT');
    assert.equal((abundance.outcomeCounts.CONFIRMED ?? 0) > 0, true);
    assert.equal((abundance.outcomeCounts.REFUSED_NO_EXECUTION_AUTHORITY ?? 0) > 0, true);
    assert.equal(abundance.totalGrantedUnits < abundance.totalPublishedUnits, true);
  });

  it('never oversells a bucket under a demand surge or mass concurrency', () => {
    for (const id of ['ACCESS-SIM-02-demand-surge', 'ACCESS-SIM-11-mass-reservation-concurrency']) {
      const result = runAccessEconomyScenario(id);
      assert.equal(result.oversoldUnits, 0n);
      for (const row of result.capacity) {
        assert.equal(row.oversoldUnits, 0n);
        assert.equal(row.committedUnits <= row.publishedUnits, true, `${id} oversold ${row.poolId}`);
      }
      assert.equal((result.outcomeCounts.REFUSED_CAPACITY_EXHAUSTED ?? 0) > 0, true);
    }
  });

  it('contracts quotes under a productive shock instead of inventing capacity', () => {
    const shocked = runAccessEconomyScenario('ACCESS-SIM-03-productive-shock');
    const abundant = runAccessEconomyScenario('ACCESS-SIM-01-abundance');
    assert.equal(shocked.totalPublishedUnits < abundant.totalPublishedUnits, true);
    assert.equal(shocked.oversoldUnits, 0n);
  });

  it('keeps geographic scarcity local to the constrained location', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-04-geographic-scarcity');
    const modes = Object.entries(result.scarcityByGroup);
    assert.equal(modes.length >= 3, true);
    assert.equal(modes.filter(([, mode]) => mode === 'SCARCE').length, 1);
    assert.equal(modes.filter(([, mode]) => mode === 'ABUNDANT').length >= 1, true);
  });

  it('keeps temporal scarcity local to the peak date', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-05-temporal-scarcity');
    assert.equal(result.scarcityByGroup['2031-11-20'], 'SCARCE');
    assert.equal(result.scarcityByGroup['2031-11-21'], 'ABUNDANT');
  });

  it('refuses on provider failure rather than silently reassigning a provider', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-06-provider-failure');
    assert.equal((result.outcomeCounts.REFUSED_PROVIDER_UNAVAILABLE ?? 0) > 0, true);
    assert.equal(
      result.decisions.every((row) => row.outcome !== 'REFUSED_PROVIDER_UNAVAILABLE' || row.grantedUnits === 0n),
      true,
    );
  });

  it('fails closed on stale capacity evidence and on an unavailable Exchange', () => {
    const stale = runAccessEconomyScenario('ACCESS-SIM-07-oracle-stale');
    assert.equal(stale.scarcityMode, 'UNAVAILABLE');
    assert.equal(stale.totalGrantedUnits, 0n);
    assert.equal((stale.outcomeCounts.CONFIRMED ?? 0), 0);

    const noQuote = runAccessEconomyScenario('ACCESS-SIM-08-exchange-unavailable');
    assert.equal(noQuote.totalGrantedUnits, 0n);
    assert.equal((noQuote.outcomeCounts.REFUSED_PRICING_UNAVAILABLE ?? 0) > 0, true);
  });

  it('releases the reservation when settlement does not complete', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-09-settlement-failure');
    const failed = result.decisions.filter((row) => row.outcome === 'REFUSED_SETTLEMENT_FAILED');
    assert.equal(failed.length > 0, true);
    assert.equal(failed.every((row) => row.grantedUnits === 0n), true);
    assert.equal(result.oversoldUnits, 0n);
    const committed = result.capacity.reduce((sum, row) => sum + row.committedUnits, 0n);
    assert.equal(committed <= result.totalPublishedUnits, true);
  });

  it('honours confirmed rights and holds later reservations across a policy change', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-10-policy-change-during-reservation');
    assert.equal(result.policyChanges.length, 1);
    assert.equal(result.policyChanges[0]?.confirmedRightsHonoured, true);
    assert.equal((result.policyChanges[0]?.pendingReservationsHeld ?? 0) > 0, true);
    const held = result.decisions.filter((row) => row.outcome === 'HELD_FOR_POLICY_REVIEW');
    assert.equal(held.every((row) => row.grantedUnits === 0n), true);
    assert.equal(held.every((row) => row.authorityRef !== null), true);
  });

  it('separates an abundant vehicle class from a genuinely scarce one', () => {
    const abundant = runAccessEconomyScenario('ACCESS-SIM-12-abundant-vehicle-class');
    const scarce = runAccessEconomyScenario('ACCESS-SIM-13-premium-scarce-vehicle');
    assert.equal(abundant.scarcityMode, 'ABUNDANT');
    assert.equal(scarce.scarcityMode, 'SCARCE');
    assert.equal((abundant.outcomeCounts.CONFIRMED ?? 0) > (scarce.outcomeCounts.CONFIRMED ?? 0), true);
    assert.equal((scarce.outcomeCounts.REFUSED_CAPACITY_EXHAUSTED ?? 0) > 0, true);
    assert.equal(scarce.oversoldUnits, 0n);
  });

  it('treats every leg of a composite travel experience as its own bucket', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-14-japan-composite-travel');
    const classes = new Set(result.capacity.map((row) => row.poolId.split('.')[1]));
    assert.equal(classes.size, 3);
    assert.equal(result.capacity.length >= 9, true);
    assert.equal(result.oversoldUnits, 0n);
  });

  it('keeps recurring household food and water access non-transferable', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-15-household-food-access');
    assert.equal(result.scarcityMode, 'ABUNDANT');
    assert.equal((result.outcomeCounts.CONFIRMED ?? 0) > 0, true);
    const serialized = JSON.stringify(result, bigintReplacer).toLowerCase();
    for (const token of FORBIDDEN_ACCESS_ASSET_TOKENS) {
      assert.equal(serialized.includes(token), false, `forbidden asset token ${token} present`);
    }
  });
});

describe('ACCESS-13 permanent Access Economy invariants', () => {
  it('states all permanent invariants', () => {
    assert.equal(ACCESS_ECONOMY_INVARIANT_IDS.length, 23);
    for (const invariant of ACCESS_ECONOMY_INVARIANT_IDS) {
      assert.equal(typeof ACCESS_INVARIANT_STATEMENTS[invariant], 'string');
      assert.equal(ACCESS_INVARIANT_STATEMENTS[invariant].length > 20, true);
    }
  });

  it('holds every invariant on every scenario', () => {
    for (const scenario of ACCESS_ECONOMY_CATALOG) {
      const result = executeAccessScenario(scenario);
      assert.deepEqual(
        result.invariants.map((row) => row.invariant),
        [...ACCESS_ECONOMY_INVARIANT_IDS],
      );
      const broken = result.invariants.filter((row) => !row.held);
      assert.deepEqual(broken, [], `${scenario.scenarioId} broke ${broken.map((row) => row.invariant).join(',')}`);
    }
  });

  it('refuses an agent that tries to approve its own proposal', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-02-demand-surge');
    const selfApproval = result.decisions.filter((row) => row.outcome === 'REFUSED_AI_SELF_APPROVAL');
    assert.equal(selfApproval.length > 0, true);
    assert.equal(selfApproval.every((row) => row.grantedUnits === 0n), true);
    assert.equal(selfApproval.every((row) => row.origin === 'AGENT_PROPOSAL'), true);
  });

  it('never grants access without a verified Execution Authority', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-01-abundance');
    const consequential = result.decisions.filter(
      (row) => row.outcome === 'CONFIRMED' || row.outcome === 'HELD_FOR_POLICY_REVIEW',
    );
    assert.equal(consequential.length > 0, true);
    assert.equal(consequential.every((row) => row.authorityRef !== null), true);
    const refusedForAuthority = result.decisions.filter(
      (row) => row.outcome === 'REFUSED_NO_EXECUTION_AUTHORITY',
    );
    assert.equal(refusedForAuthority.every((row) => row.grantedUnits === 0n), true);
  });

  it('never issues an Execution Authority from inside the simulation', () => {
    const scenario = accessScenarioById('ACCESS-SIM-01-abundance')!;
    const pools = buildCapacityPools(scenario, macroReport(scenario));
    const requests = buildRequests(scenario, pools);
    assert.equal(requests.length > 0, true);
    for (const request of requests) {
      if (request.authority) {
        assert.equal(request.authority.issuedBySimulation, false);
      }
    }
  });

  it('refuses rather than inferring legal eligibility when policy is silent', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-01-abundance');
    const undetermined = result.decisions.filter((row) => row.outcome === 'REFUSED_ELIGIBILITY_UNDETERMINED');
    assert.equal(undetermined.length > 0, true);
    assert.equal(undetermined.every((row) => row.grantedUnits === 0n), true);
  });

  it('attributes settlement only to the canonical ledger owner', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-09-settlement-failure');
    const owners = new Set(result.decisions.map((row) => row.settlementOwner).filter((owner) => owner !== null));
    assert.deepEqual([...owners], ['packages/ledger']);
    assert.equal(result.canonicalIntegrations.exchange, 'packages/sunrey-exchange');
    assert.equal(result.canonicalIntegrations.custody, 'packages/custody');
    assert.equal(result.canonicalIntegrations.entitlements, 'packages/access-fabric');
    assert.equal(result.canonicalIntegrations.executionAuthority, 'packages/permissions');
  });

  it('issues no native asset and asserts no SunRey/MoonRey peg', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-12-abundant-vehicle-class');
    assert.equal(result.nativeIssuance.sunreyIssuedBySimulation, 0n);
    assert.equal(result.nativeIssuance.moonreyIssuedBySimulation, 0n);
    assert.equal(result.nativeIssuance.fixedSunreyMoonreyPeg, null);
    const macro = simulateScenario(result.macroScenarioId, { seed: result.seed, epochs: 2 });
    assert.equal(macro.bridge.intrinsicExchangeRatio, null);
    assert.equal(macro.bridge.policy.algorithmicPeg, false);
  });

  it('carries no human-worth score on any decision', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-11-mass-reservation-concurrency');
    assert.equal(result.decisions.every((row) => row.humanWorthScore === false), true);
    const serialized = JSON.stringify(result.decisions, bigintReplacer);
    for (const forbidden of ['socialCreditScore', 'reputationScore', 'desirabilityScore']) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });
});

describe('ACCESS-13 Access Economy evidence', () => {
  it('seals every decision into a verifiable hash chain', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-10-policy-change-during-reservation');
    assert.equal(result.evidence.chainVerified, true);
    assert.equal(result.evidence.recordCount > result.decisions.length, true);
    assert.equal(result.evidence.sealedConsequentialTransitions, result.evidence.consequentialTransitions);
    assert.equal(result.decisions.every((row) => row.evidenceSeq.length > 0), true);
    const seqs = result.decisions.map((row) => Number(row.evidenceSeq));
    assert.deepEqual(seqs, [...seqs].sort((left, right) => left - right));
  });

  it('refuses to seal raw sensitive personal information', () => {
    const evidence = new AccessSimulationEvidence();
    assert.throws(
      () => evidence.seal('access.request.decided', { subjectId: 's1', passportNumber: 'X1234567' }),
      /forbidden sensitive key 'passportNumber'/,
    );
    assert.throws(
      () => assertSealablePayload({ nested: { rawPdvContent: 'anything' } }),
      /forbidden sensitive key 'rawPdvContent'/,
    );
    assert.doesNotThrow(() => assertSealablePayload({ humanWorthScore: false, subjectId: 's1' }));
  });

  it('rejects an unknown evidence kind', () => {
    const evidence = new AccessSimulationEvidence();
    assert.throws(
      // @ts-expect-error deliberately invalid evidence kind
      () => evidence.seal('access.request.approved-by-vibes', {}),
      /unknown access evidence kind/,
    );
  });
});

describe('ACCESS-13 end-to-end qualification', () => {
  it('qualifies the Access Fabric as code-complete candidate only', () => {
    const report = qualifyAccessEconomy();
    assert.equal(report.scenarioCount, 18);
    assert.equal(report.allInvariantsHeld, true);
    assert.deepEqual(report.invariantViolations, []);
    assert.equal(report.evidenceChainsVerified, true);
    assert.equal(report.oversoldUnits, 0n);
    assert.equal(report.qualificationState, ACCESS_FABRIC_QUALIFICATION_STATE);
    assert.equal(report.qualificationState, 'ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE');
  });

  it('does not move any production state because tests pass', () => {
    const report = qualifyAccessEconomy();
    assert.equal(report.productionPosture.PRODUCTION_READY, false);
    assert.equal(report.productionPosture.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(report.productionPosture.PRODUCTION_ACTIVE, false);
    assert.equal(report.productionPosture.changedByThisRun, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(SIMULATION_MODE, true);
    for (const result of report.results) {
      assert.equal(result.productionActivation.environment, 'simulation');
      assert.equal(result.productionActivation.liveFlagsChanged, false);
      assert.equal(result.productionActivation.productionAuthorization, false);
    }
  });

  it('records the dependencies and gates that remain outside engineering control', () => {
    const report = qualifyAccessEconomy();
    assert.equal(report.remainingSimulatedDependencies.length >= 5, true);
    assert.equal(report.remainingRealWorldProviderRequirements.length >= 5, true);
    assert.equal(report.remainingLegalGates.length >= 5, true);
    const rendered = renderAccessQualification(report);
    assert.match(rendered, /ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE/);
    assert.match(rendered, /PRODUCTION_READY=false/);
  });
});

describe('ACCESS-13 Access Economy CLI', () => {
  it('lists scenarios and invariants', () => {
    const listed = runAccessEconomyCommand(['scenario', '--list']);
    assert.match(listed, /ACCESS-SIM-01-abundance/);
    assert.match(listed, /ACCESS-SIM-15-household-food-access/);
    const invariants = runAccessEconomyCommand(['invariants']);
    assert.match(invariants, /NO_OVERSOLD_PRODUCTIVE_CAPACITY/);
    assert.match(invariants, /SIMULATION_CANNOT_ACTIVATE_PRODUCTION/);
  });

  it('runs one scenario and reports the qualification payload as JSON', () => {
    const run = JSON.parse(runAccessEconomyCommand(['run', '--scenario', 'ACCESS-SIM-13-premium-scarce-vehicle'])) as {
      readonly invariantsHeld: boolean;
      readonly oversoldUnits: string;
      readonly scarcityMode: string;
    };
    assert.equal(run.invariantsHeld, true);
    assert.equal(run.oversoldUnits, '0');
    assert.equal(run.scarcityMode, 'SCARCE');

    const qualified = JSON.parse(runAccessEconomyCommand(['qualify', '--json'])) as {
      readonly qualificationState: string;
      readonly productionPosture: Record<string, boolean>;
    };
    assert.equal(qualified.qualificationState, 'ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE');
    assert.equal(qualified.productionPosture.PRODUCTION_ACTIVE, false);
  });

  it('is reachable from the sunrey-economics access plane', () => {
    const listed = runEconomicsCommand(['access', 'scenario', '--list']);
    assert.match(listed, /ACCESS-SIM-02-demand-surge/);
    const usage = runEconomicsCommand([]);
    assert.match(usage, /sunrey-economics access qualify/);
  });

  it('rejects an unknown scenario id', () => {
    assert.throws(() => runAccessEconomyScenario('ACCESS-SIM-99-nope'), /unknown access economy scenario/);
    assert.throws(() => runAccessEconomyCommand(['scenario', '--id', 'nope']), /unknown access economy scenario/);
  });
});
