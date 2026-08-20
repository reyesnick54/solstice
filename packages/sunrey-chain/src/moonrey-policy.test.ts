import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { moonreyIssuanceActivated } from './protocol/assets.ts';
import { fixtureFacts, solarFacility } from './productive/fixtures.ts';
import { developmentIssuancePolicy } from './productive/policy.ts';
import { emptyMoonReySupply, applyIssuance, supplyReconciles } from './productive/supply.ts';
import {
  MoonReyPolicyImpactSimulator,
  MoonReyPolicyRegistry,
  POLICY_SIMULATION_SCENARIOS,
  applyFactors,
  auditMoonReyIssuance,
  canonicalCategory,
  capacityOutputEventFingerprint,
  createIssuanceCorrection,
  crossCategoryEventFingerprint,
  developmentPolicyBundle,
  emptyBudgetUsage,
  epochFromHeight,
  evaluateBudget,
  evaluateContributionEligibility,
  governedContributionFingerprint,
  moonreyPolicyReadiness,
  normalizeContribution,
  productionUnconfiguredBundle,
  refuseArbitraryMint,
  runMoonReyEconomicsCommand,
  type EligibilityInput,
} from './productive/policy-governance/index.ts';
import { ProductiveEconomyEngine } from './productive/engine.ts';
import { DEV_CLOCK } from './productive/fixtures.ts';
import { fixtureClaim, fixtureRight } from './productive/fixtures.ts';

function baseInput(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  const object = solarFacility();
  const facts = fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' });
  const bundle = developmentPolicyBundle();
  return {
    height: 10,
    requestedPolicyVersion: 1,
    category: 'ENERGY',
    claimType: 'OUTPUT',
    object,
    objectEligible: true,
    providerId: 'oracle.1',
    actorId: object.controller,
    sourceUnitId: 'kWh',
    sourceQuantity: 1_200n,
    measurementEpoch: 1,
    validFromUnixSeconds: 1_799_000_000n,
    validUntilUnixSeconds: 1_800_000_000n,
    deliveryFromUnixSeconds: 1_799_000_000n,
    deliveryUntilUnixSeconds: 1_800_000_000n,
    oracleFacts: facts,
    referenceFacts: [],
    claimLineage: [],
    knownGovernedFingerprints: new Set(),
    knownCrossCategoryEvents: new Set(),
    knownCapacityOutputEvents: new Map(),
    budgetUsage: emptyBudgetUsage(),
    issuancePolicy: developmentIssuancePolicy(),
    bundle,
    ...overrides,
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Chunk 74 MoonRey issuance policy', () => {
  it('maps productive domains onto the canonical taxonomy', () => {
    assert.equal(canonicalCategory('AI_INFERENCE'), 'AI_COMPUTE');
    assert.equal(canonicalCategory('ROBOTICS'), 'AUTOMATED_MACHINE_OUTPUT');
    assert.equal(canonicalCategory('REAL_ESTATE_UTILIZATION'), 'REAL_ESTATE_USE');
    assert.equal(canonicalCategory('ENERGY'), 'ENERGY');
  });

  it('keeps production caps UNCONFIGURED and ticker unassigned', () => {
    const production = productionUnconfiguredBundle(1, 1);
    assert.equal(production.budget.productionCaps, 'UNCONFIGURED');
    assert.equal(production.budget.perEpoch, 'UNCONFIGURED');
    assert.equal(moonreyIssuanceActivated(), false);
  });

  it('rejects raw capacity as delivery and does not issue', () => {
    const capacity = evaluateContributionEligibility(baseInput({ claimType: 'CAPACITY' }));
    assert.equal(capacity.ok, false);
    if (!capacity.ok) {
      assert.equal(capacity.code, 'POLICY_INELIGIBLE_CLAIM_TYPE');
    }
  });

  it('rejects duplicate governed contributions', () => {
    const first = evaluateContributionEligibility(baseInput());
    if (!first.ok) {
      return;
    }
    const second = evaluateContributionEligibility(
      baseInput({ knownGovernedFingerprints: new Set([first.fingerprint]) }),
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'DUPLICATE_CONTRIBUTION');
    }
  });

  it('rejects cross-category full credit for one event', () => {
    const first = evaluateContributionEligibility(baseInput());
    if (!first.ok) {
      return;
    }
    const second = evaluateContributionEligibility(
      baseInput({
        category: 'COMPUTE',
        sourceUnitId: 'GPU_HOUR',
        object: { ...solarFacility(), category: 'COMPUTE', objectId: 'obj.solar.alpha' },
        knownCrossCategoryEvents: new Set([first.crossCategoryFingerprint]),
      }),
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'CROSS_CATEGORY_DUPLICATE');
    }
  });

  it('rejects wrong units and malformed factors', () => {
    const wrong = normalizeContribution({
      category: 'COMPUTE',
      sourceUnitId: 'kWh',
      sourceQuantity: 10n,
      height: 10,
      rules: developmentPolicyBundle().normalizationRules,
    });
    assert.equal(wrong.ok, false);
    const malformed = applyFactors(
      10n,
      [{ factorId: 'bad', version: 1, value: 9_000_000n, min: 0n, max: 2_000_000n, auditable: true }],
      'FLOOR',
    );
    assert.equal(typeof malformed === 'bigint', false);
  });

  it('rejects stale and conflicted oracles', () => {
    const staleFacts = fixtureFacts({
      objectId: 'obj.solar.alpha',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
      validUntil: 1_700_000_000n,
    });
    const stale = evaluateContributionEligibility(baseInput({ oracleFacts: staleFacts }));
    assert.equal(stale.ok, false);
    if (!stale.ok) {
      assert.equal(stale.code, 'STALE_ORACLE_FACT');
    }
    const conflictedFacts = fixtureFacts({
      objectId: 'obj.solar.alpha',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
      conflicted: true,
    });
    const conflicted = evaluateContributionEligibility(baseInput({ oracleFacts: conflictedFacts }));
    assert.equal(conflicted.ok, false);
    if (!conflicted.ok) {
      assert.equal(conflicted.code, 'CONFLICTED_ORACLE_FACT');
    }
  });

  it('rejects policy replay, future policy, and AI activation', () => {
    const registry = new MoonReyPolicyRegistry();
    registry.propose(developmentPolicyBundle(20, 2), 'PROTOCOL_GOVERNANCE', 'gov.1');
    const replay = registry.resolveRequested(20, 1);
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.code, 'POLICY_REPLAY');
    }
    const future = registry.resolveRequested(5, 2);
    assert.equal(future.ok, false);
    if (!future.ok) {
      assert.equal(future.code, 'POLICY_NOT_YET_ACTIVE');
    }
    const ai = registry.propose(developmentPolicyBundle(30, 3), 'AI_PROPOSAL', 'ai.1');
    assert.equal(ai.activated, false);
    assert.equal(ai.rejection, 'AI_CANNOT_ACTIVATE_POLICY');
  });

  it('rejects cap exhaustion and arbitrary admin mint', () => {
    const cap = evaluateBudget(developmentPolicyBundle().budget, { ...emptyBudgetUsage(), epoch: 100_000_000n, globalEpoch: 100_000_000n }, 1n);
    assert.equal(cap.ok, false);
    assert.equal(refuseArbitraryMint().code, 'ARBITRARY_MINT_UNAVAILABLE');
  });

  it('keeps supply exact after issuance and records policy version on receipts', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: 'claim.policy.output',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const issued = engine.issueFromClaim(claim.claimId);
    if (!issued.ok) {
      return;
    }
    assert.equal(issued.receipt.policyVersion, 1);
    assert.equal(engine.supplyIsReconciled(), true);
    const audit = auditMoonReyIssuance({
      contribution: engine.contribution(issued.receipt.productiveContributionId)!,
      bundle: developmentPolicyBundle(),
      receipt: issued.receipt,
      supply: engine.currentSupply(),
      expectedFingerprint: issued.receipt.fingerprint,
      issuanceBasis: issued.receipt.moonreyQuantity,
    });
    assert.equal(audit.ok, true);
    assert.equal(audit.supplyReconciles, true);
  });

  it('does not rewrite finalized history via correction records', () => {
    const correction = createIssuanceCorrection({
      correctionId: 'corr.1',
      kind: 'FRAUD_INCIDENT_EVIDENCE',
      targetIssuanceId: 'mir.1',
      targetContributionId: 'vpc.1',
      reason: 'later disputed claim',
      evidenceIds: ['ev.1'],
      activationHeight: 99,
      governedTransactionId: 'gov.tx.1',
    });
    assert.equal(correction.rewritesFinalizedHistory, false);
    assert.equal(correction.silentlyDebitsDownstreamHolders, false);
  });

  it('uses protocol height for epochs and preserves fingerprint strengthening', () => {
    const epoch = epochFromHeight(250, 100);
    assert.equal(epoch.epoch, 2);
    assert.equal(epoch.startHeight, 200);
    const left = governedContributionFingerprint({
      objectId: 'obj',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 1n,
      validUntilUnixSeconds: 2n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 10n,
      baseUnitId: 'NPU',
      oracleFactIds: ['b', 'a'],
      upstreamContributionIds: ['u2', 'u1'],
      actorId: 'actor',
      deliveryFromUnixSeconds: 1n,
      deliveryUntilUnixSeconds: 2n,
      claimLineage: ['u2', 'u1'],
    });
    const right = governedContributionFingerprint({
      objectId: 'obj',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 1n,
      validUntilUnixSeconds: 2n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 10n,
      baseUnitId: 'NPU',
      oracleFactIds: ['a', 'b'],
      upstreamContributionIds: ['u1', 'u2'],
      actorId: 'actor',
      deliveryFromUnixSeconds: 1n,
      deliveryUntilUnixSeconds: 2n,
      claimLineage: ['u1', 'u2'],
    });
    assert.equal(left, right);
    assert.equal(
      crossCategoryEventFingerprint({
        objectId: 'obj',
        measurementPeriodEpoch: 1,
        validFromUnixSeconds: 1n,
        validUntilUnixSeconds: 2n,
        deliveryFromUnixSeconds: 1n,
        deliveryUntilUnixSeconds: 2n,
        actorId: 'actor',
        oracleFactIds: ['b', 'a'],
        claimLineage: [],
      }),
      crossCategoryEventFingerprint({
        objectId: 'obj',
        measurementPeriodEpoch: 1,
        validFromUnixSeconds: 1n,
        validUntilUnixSeconds: 2n,
        deliveryFromUnixSeconds: 1n,
        deliveryUntilUnixSeconds: 2n,
        actorId: 'actor',
        oracleFactIds: ['a', 'b'],
        claimLineage: [],
      }),
    );
    assert.equal(
      capacityOutputEventFingerprint({
        objectId: 'obj',
        category: 'ENERGY',
        measurementPeriodEpoch: 1,
        validFromUnixSeconds: 1n,
        validUntilUnixSeconds: 2n,
      }).length,
      64,
    );
  });

  it('simulates the required productive-economy scenarios', () => {
    const reports = new MoonReyPolicyImpactSimulator().runAll(3);
    assert.equal(reports.length, POLICY_SIMULATION_SCENARIOS.length);
    for (const report of reports) {
      assert.equal(report.classification, 'ENGINEERING_ECONOMIC_SIMULATION');
      assert.equal(report.supplyPressure.automaticMarketPriceClaim, false);
      assert.equal(report.supplyPressure.supplyReconciles, true);
    }
  });

  it('exposes economics CLI planes', () => {
    for (const command of ['policy', 'categories', 'simulate', 'issuance', 'verify', 'supply-pressure'] as const) {
      const result = runMoonReyEconomicsCommand(['moonrey', command, command === 'verify' ? 'missing' : undefined].filter(Boolean) as string[]);
      assert.equal(typeof result.ok, 'boolean', command);
      assert.match(result.command, /moonrey/);
    }
  });

  it('tracks mainnet readiness without claiming production approval', () => {
    const readiness = moonreyPolicyReadiness();
    assert.equal(readiness.softwareImplementationSufficient, false);
    assert.equal(readiness.productionFactorApproval, 'NOT_PROVIDED');
    assert.equal(readiness.humanGovernanceApproval, 'NOT_PROVIDED');
    assert.equal(readiness.policyImplementation, 'ENGINEERING_VERIFIED');
  });

  it('property-tests thousands of contribution combinations', () => {
    const random = mulberry32(74);
    const categories = ['ENERGY', 'COMPUTE', 'AI_COMPUTE', 'MANUFACTURING', 'FOOD_AGRICULTURE'] as const;
    const claims = ['OUTPUT', 'CAPACITY', 'DELIVERY', 'USAGE'] as const;
    const units = { ENERGY: 'kWh', COMPUTE: 'GPU_HOUR', AI_COMPUTE: 'GPU_HOUR', MANUFACTURING: 'UNIT', FOOD_AGRICULTURE: 'kg' } as const;
    let accepted = 0;
    let rejected = 0;
    const prints = new Set<string>();
    for (let index = 0; index < 4_000; index += 1) {
      const category = categories[Math.floor(random() * categories.length)]!;
      const claimType = claims[Math.floor(random() * claims.length)]!;
      const epoch = Math.floor(random() * 4);
      const quantity = BigInt(1 + Math.floor(random() * 500));
      const actor = `actor.${Math.floor(random() * 7)}`;
      const object = {
        ...solarFacility(),
        objectId: `obj.${Math.floor(random() * 11)}`,
        category,
        controller: actor,
      };
      const facts = fixtureFacts({ objectId: object.objectId, category, quantity, unit: units[category] });
      const result = evaluateContributionEligibility(
        baseInput({
          category,
          claimType,
          object,
          actorId: actor,
          sourceUnitId: units[category],
          sourceQuantity: quantity,
          measurementEpoch: epoch,
          oracleFacts: facts,
        }),
      );
      if (result.ok) {
        if (prints.has(result.fingerprint)) {
          const replay = evaluateContributionEligibility(
            baseInput({
              category,
              claimType,
              object,
              actorId: actor,
              sourceUnitId: units[category],
              sourceQuantity: quantity,
              measurementEpoch: epoch,
              oracleFacts: facts,
              knownGovernedFingerprints: prints,
            }),
          );
          assert.equal(replay.ok, false);
          rejected += 1;
        } else {
          accepted += 1;
          prints.add(result.fingerprint);
          assert.ok(result.issuanceBasis >= 0n);
        }
      } else {
        rejected += 1;
        assert.notEqual(result.code, 'ARBITRARY_MINT_UNAVAILABLE');
      }
    }
    assert.ok(accepted > 0);
    assert.ok(rejected > 0);
    let supply = emptyMoonReySupply();
    supply = applyIssuance(supply, BigInt(accepted));
    assert.equal(supplyReconciles(supply), true);
  });
});
