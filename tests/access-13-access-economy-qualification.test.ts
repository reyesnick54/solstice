/**
 * ACCESS-13 cross-package integration and end-to-end qualification.
 *
 * Composes the canonical access entitlement engine, the dual-economy
 * simulator, the economic stress laboratory, the Evidence Vault, and the
 * deployment posture flags. Asserts the permanent Access Economy
 * invariants across the whole surface, and asserts that a passing run
 * moves no production state.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ACCESS_FABRIC_INVARIANTS,
  AccessEntitlementEngine,
  transferAllowed,
} from '../packages/access-fabric/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ENVIRONMENT, LIVE_MONEY_ENABLED, SIMULATION_MODE } from '../packages/config/src/flags.ts';
import {
  ACCESS_ECONOMY_CATALOG,
  ACCESS_ECONOMY_INVARIANT_IDS,
  qualifyAccessEconomy,
  runAccessEconomyScenario,
} from '../packages/sunrey-economics/src/access-economy/index.ts';
import { runEconomicsCommand } from '../packages/sunrey-economics/src/cli.ts';
import { runStressCampaign } from '../packages/sunrey-economics/src/stress/campaign.ts';
import { ACCESS_STRESS_IDS } from '../packages/sunrey-economics/src/stress/catalog.ts';
import { accessScenarioForShock } from '../packages/sunrey-economics/src/stress/engine.ts';
import { ECONOMIC_INVARIANT_IDS } from '../packages/sunrey-economics/src/stress/ids.ts';

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

describe('ACCESS-13 Access Economy end-to-end qualification', () => {
  it('qualifies all eighteen scenarios with every invariant holding', () => {
    const report = qualifyAccessEconomy();
    assert.equal(report.scenarioCount, 18);
    assert.equal(report.results.length, ACCESS_ECONOMY_CATALOG.length);
    assert.equal(report.invariants.length, 23);
    assert.deepEqual(report.invariantViolations, []);
    assert.equal(report.allInvariantsHeld, true);
    assert.equal(report.evidenceChainsVerified, true);
    assert.equal(report.oversoldUnits, 0n);
    assert.equal(report.refusalsAreFirstClass, true);
    assert.equal(report.qualificationState, 'ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE');
  });

  it('separates the engineering candidate label from every production state', () => {
    const report = qualifyAccessEconomy();
    assert.notEqual(report.qualificationState, 'PRODUCTION_READY');
    assert.equal(report.productionPosture.PRODUCTION_READY, false);
    assert.equal(report.productionPosture.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(report.productionPosture.PRODUCTION_ACTIVE, false);
    assert.equal(report.productionPosture.changedByThisRun, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(SIMULATION_MODE, true);
    assert.equal(LIVE_MONEY_ENABLED, false);
  });

  it('never oversells published productive capacity in any scenario or bucket', () => {
    const report = qualifyAccessEconomy();
    for (const result of report.results) {
      assert.equal(result.oversoldUnits, 0n, `${result.scenarioId} oversold capacity`);
      for (const row of result.capacity) {
        assert.equal(
          row.committedUnits <= row.publishedUnits,
          true,
          `${result.scenarioId} oversold ${row.poolId}`,
        );
      }
      assert.equal(result.totalGrantedUnits <= result.totalPublishedUnits, true);
    }
  });

  it('grants nothing without a verified Execution Authority and nothing to a self-approving agent', () => {
    const report = qualifyAccessEconomy();
    for (const result of report.results) {
      for (const decision of result.decisions) {
        if (decision.grantedUnits > 0n) {
          assert.notEqual(decision.authorityRef, null, `${decision.requestId} granted without authority`);
          assert.notEqual(decision.outcome, 'REFUSED_AI_SELF_APPROVAL');
        }
        if (decision.outcome === 'REFUSED_AI_SELF_APPROVAL') {
          assert.equal(decision.grantedUnits, 0n);
        }
      }
    }
  });

  it('introduces no access-denominated asset and no new monetary authority', () => {
    const report = qualifyAccessEconomy();
    const serialized = JSON.stringify(report.results, bigintReplacer).toLowerCase();
    for (const token of ['accesscoin', 'access_coin', 'access-coin', 'accesscurrency', 'accesscredits']) {
      assert.equal(serialized.includes(token), false, `forbidden asset token ${token} present`);
    }
    for (const result of report.results) {
      assert.equal(result.nativeIssuance.sunreyIssuedBySimulation, 0n);
      assert.equal(result.nativeIssuance.moonreyIssuedBySimulation, 0n);
      assert.equal(result.nativeIssuance.fixedSunreyMoonreyPeg, null);
      assert.equal(result.canonicalIntegrations.executionAuthority, 'packages/permissions');
      assert.equal(result.canonicalIntegrations.ledger, 'packages/ledger');
      assert.equal(result.canonicalIntegrations.exchange, 'packages/sunrey-exchange');
      assert.equal(result.canonicalIntegrations.custody, 'packages/custody');
    }
  });

  it('keeps access entitlements non-monetary and non-transferable by default', () => {
    assert.equal(ACCESS_FABRIC_INVARIANTS.humanWorthScore, false);
    assert.equal(ACCESS_FABRIC_INVARIANTS.isMonetaryAsset, false);
    assert.equal(ACCESS_FABRIC_INVARIANTS.isTransferableBalance, false);
    assert.equal(ACCESS_FABRIC_INVARIANTS.defaultTransferability, false);

    const now = asUtcInstant('2031-04-01T00:00:00.000Z');
    const entitlement = {
      entitlementId: 'aent_integration_1' as never,
      subjectId: 'subj_integration',
      category: 'regional-mobility',
      capacity: 10n,
      startAt: asUtcInstant('2031-03-01T00:00:00.000Z'),
      endAt: asUtcInstant('2031-12-01T00:00:00.000Z'),
      jurisdiction: 'US-CA',
      geographicScope: 'US-CA',
      purpose: 'ACCESS_REGIONAL_MOBILITY',
      restrictions: Object.freeze([]),
      expiry: asUtcInstant('2031-12-01T00:00:00.000Z'),
      replenishment: {
        kind: 'FIXED_WINDOW' as const,
        windowStartAt: asUtcInstant('2031-03-01T00:00:00.000Z'),
        windowEndAt: asUtcInstant('2031-12-01T00:00:00.000Z'),
        quantityPerWindow: 10n,
      },
      provenance: 'PURCHASED' as const,
      transferability: false,
      humanWorthScore: false as const,
      isMonetaryAsset: false as const,
      isTransferableBalance: false as const,
    };
    const transfer = transferAllowed(entitlement);
    assert.equal(transfer.ok, false);

    const engine = new AccessEntitlementEngine();
    const evaluated = engine.evaluate({
      subjectId: 'subj_integration',
      evaluatedAt: now,
      entitlements: [entitlement],
      mandates: Object.freeze([]),
      policyEligibility: Object.freeze([]),
      usage: Object.freeze([]),
      reservations: Object.freeze([]),
      jurisdictionCapability: {
        actorJurisdiction: 'US-CA',
        permittedJurisdictions: Object.freeze(['US-CA']),
        geographicScopes: Object.freeze(['US-CA']),
      },
    });
    assert.equal(evaluated.ok, true);
    if (evaluated.ok) {
      assert.equal(evaluated.value.envelope.humanWorthScore, false);
      assert.equal(evaluated.value.envelope.eligibleRequests.length, 1);
      assert.equal(evaluated.value.envelope.eligibleRequests[0]?.transferability, false);
    }
  });

  it('refuses to let raw sensitive personal information reach the evidence chain', () => {
    const report = qualifyAccessEconomy();
    const serialized = JSON.stringify(report.results, bigintReplacer);
    for (const key of [
      'passportNumber',
      'nationalIdNumber',
      'medicalRecord',
      'biometricTemplate',
      'rawPdvContent',
      'socialCreditScore',
    ]) {
      assert.equal(serialized.includes(`"${key}"`), false, `sensitive key ${key} reached the run payload`);
    }
    for (const result of report.results) {
      assert.equal(result.evidence.forbiddenKeysPresent, false);
      assert.equal(result.evidence.chainVerified, true);
    }
  });

  it('makes every consequential transition reconstructable from evidence', () => {
    const result = runAccessEconomyScenario('ACCESS-SIM-14-japan-composite-travel');
    assert.equal(result.evidence.chainVerified, true);
    assert.equal(result.evidence.sealedConsequentialTransitions, result.evidence.consequentialTransitions);
    assert.equal(result.evidence.consequentialTransitions, result.decisions.length);
    const replayed = runAccessEconomyScenario('ACCESS-SIM-14-japan-composite-travel');
    assert.equal(replayed.evidence.headRecordSha256, result.evidence.headRecordSha256);
    assert.equal(replayed.resultDigestSha256, result.resultDigestSha256);
  });
});

describe('ACCESS-13 stress laboratory integration', () => {
  it('binds each ACCESS stress shock to exactly one Access Economy scenario', () => {
    assert.equal(ACCESS_STRESS_IDS.length, 18);
    const mapped = new Set<string>();
    for (const shock of [
      'ACCESS_ABUNDANCE',
      'ACCESS_DEMAND_SURGE',
      'ACCESS_PRODUCTIVE_SHOCK',
      'ACCESS_GEOGRAPHIC_SCARCITY',
      'ACCESS_TEMPORAL_SCARCITY',
      'ACCESS_PROVIDER_FAILURE',
      'ACCESS_ORACLE_STALE',
      'ACCESS_EXCHANGE_UNAVAILABLE',
      'ACCESS_SETTLEMENT_FAILURE',
      'ACCESS_POLICY_CHANGE',
      'ACCESS_MASS_CONCURRENCY',
      'ACCESS_ABUNDANT_VEHICLE',
      'ACCESS_PREMIUM_SCARCE_VEHICLE',
      'ACCESS_COMPOSITE_TRAVEL',
      'ACCESS_HOUSEHOLD_FOOD',
      'ACCESS_COMPUTE_CAPACITY',
      'ACCESS_ROBOT_CAPACITY',
      'ACCESS_ENERGY_ACCESS',
    ] as const) {
      const scenarioId = accessScenarioForShock(shock);
      assert.notEqual(scenarioId, undefined, `shock ${shock} has no access scenario`);
      mapped.add(scenarioId!);
    }
    assert.equal(mapped.size, 18);
  });

  it('adds the four access invariants to the canonical economic invariant list', () => {
    for (const invariant of [
      'ACCESS_CAPACITY_NOT_OVERSOLD',
      'ACCESS_RESERVATION_REQUIRES_EXECUTION_AUTHORITY',
      'ACCESS_ACTIVITY_ISSUES_NO_NATIVE_ASSET',
      'ACCESS_EVIDENCE_CHAIN_RECONSTRUCTS',
    ] as const) {
      assert.equal(
        (ECONOMIC_INVARIANT_IDS as readonly string[]).includes(invariant),
        true,
        `${invariant} missing from ECONOMIC_INVARIANT_IDS`,
      );
    }
    assert.equal(ACCESS_ECONOMY_INVARIANT_IDS.length, 23);
  });

  it('runs the access-economy stress campaign with no violations and no production authorization', () => {
    const report = runStressCampaign('access-economy');
    assert.equal(report.scenarioCount, 18);
    assert.equal(report.violations, 0);
    assert.equal(report.openFindings.filter((row) => row.severity === 'CRITICAL').length, 0);
    assert.equal(report.productionAuthorization, false);
    assert.equal(report.performanceContext.protocolChecksWeakened, false);
  });

  it('exposes the access plane through the economics CLI', () => {
    const qualified = JSON.parse(runEconomicsCommand(['access', 'qualify', '--json'])) as {
      readonly qualificationState: string;
      readonly oversoldUnits: string;
      readonly remainingLegalGates: readonly string[];
    };
    assert.equal(qualified.qualificationState, 'ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE');
    assert.equal(qualified.oversoldUnits, '0');
    assert.equal(qualified.remainingLegalGates.length >= 5, true);
  });
});

describe('ACCESS-13 recorded architecture closure', () => {
  it('records the ownership table and the data flow in architecture documentation', () => {
    const architecture = readFileSync('docs/architecture/access-fabric-architecture.md', 'utf8');
    assert.match(architecture, /## Ownership table/);
    assert.match(architecture, /packages\/access-fabric/);
    assert.match(architecture, /packages\/sunrey-economics/);
    assert.match(architecture, /```mermaid/);
    assert.match(architecture, /Execution Authority/);
  });

  it('records the ACCESS-13 status report with production states kept separate', () => {
    const status = readFileSync('docs/architecture/ACCESS_FABRIC_STATUS.md', 'utf8');
    assert.match(status, /ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE/);
    assert.match(status, /`PRODUCTION_READY` \| false/);
    assert.match(status, /`LIVE_CONNECTIVITY_ENABLED` \| false/);
    assert.match(status, /`PRODUCTION_ACTIVE` \| false/);
    assert.match(status, /Remaining legal and regulatory gates/);
    assert.match(status, /Unresolved architecture decisions/);
  });
});
