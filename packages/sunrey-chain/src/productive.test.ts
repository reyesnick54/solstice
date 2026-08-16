import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { moonreyIssuanceActivated } from './protocol/assets.ts';
import { runProductiveCommand } from './productive/cli.ts';
import { fourValidatorsAgree, runAllDemos, runComputeDemo, runEnergyDemo, runManufacturingDemo } from './productive/demo.ts';
import { ProductiveEconomyEngine } from './productive/engine.ts';
import {
  automatedFactory,
  DEV_CLOCK,
  fixtureClaim,
  fixtureFacts,
  fixtureObject,
  fixtureRight,
  solarFacility,
} from './productive/fixtures.ts';
import { evaluateIssuanceFormula, mulDiv } from './productive/formula.ts';
import { buildProductiveCapacityGraph } from './productive/graph.ts';
import { developmentIssuancePolicy } from './productive/policy.ts';
import { FORMULA_VERSION, POLICY_PARAMETER_CLASS, PRODUCTIVE_CATEGORIES, WEIGHT_SCALE } from './productive/types.ts';
import { defaultUnitRegistry } from './productive/units.ts';

function seededEnergyEngine(): ProductiveEconomyEngine {
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  const object = solarFacility();
  engine.registerObject(object);
  engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
  for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' })) {
    engine.putOracleFact(fact);
  }
  return engine;
}

describe('Chunk 44 productive capacity and MoonRey issuance', () => {
  it('rejects an unregistered productive object', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const claim = fixtureClaim({
      claimId: 'claim.missing',
      objectId: 'obj.missing',
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const result = engine.verifyClaim(claim.claimId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'UNREGISTERED_OBJECT');
    }
  });

  it('rejects missing rights', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 10n, unit: 'kWh' })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: 'claim.norights',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const result = engine.verifyClaim(claim.claimId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'MISSING_RIGHTS');
    }
  });

  it('rejects insufficient oracle quorum', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({
      objectId: object.objectId,
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
      count: 2,
    })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: 'claim.quorum',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
      factCount: 2,
    });
    engine.submitClaim(claim);
    const result = engine.verifyClaim(claim.claimId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'INSUFFICIENT_ORACLE_QUORUM');
    }
  });

  it('rejects a stale oracle fact', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({
      objectId: object.objectId,
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
      validUntil: 1_799_000_001n,
    })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: 'claim.stale',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const result = engine.verifyClaim(claim.claimId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'STALE_ORACLE_FACT');
    }
  });

  it('rejects a conflicted oracle fact', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({
      objectId: object.objectId,
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
      conflicted: true,
    })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: 'claim.conflict',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const result = engine.verifyClaim(claim.claimId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'CONFLICTED_ORACLE_FACT');
    }
  });

  it('rejects a duplicate contribution fingerprint', () => {
    const engine = seededEnergyEngine();
    const first = fixtureClaim({
      claimId: 'claim.a',
      objectId: 'obj.solar.alpha',
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n,
      unit: 'kWh',
    });
    const second = fixtureClaim({
      claimId: 'claim.b',
      objectId: 'obj.solar.alpha',
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n,
      unit: 'kWh',
    });
    engine.submitClaim(first);
    engine.submitClaim(second);
    assert.equal(engine.verifyClaim(first.claimId).ok, true);
    const dup = engine.verifyClaim(second.claimId);
    assert.equal(dup.ok, false);
    if (!dup.ok) {
      assert.equal(dup.code, 'DUPLICATE_CONTRIBUTION');
    }
  });

  it('rejects duplicate issuance of the same contribution', () => {
    const engine = seededEnergyEngine();
    const claim = fixtureClaim({
      claimId: 'claim.once',
      objectId: 'obj.solar.alpha',
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const first = engine.issueFromClaim(claim.claimId);
    assert.equal(first.ok, true);
    const verified = engine.verifyClaim(claim.claimId);
    assert.equal(verified.ok, false);
  });

  it('keeps capacity and output distinct and does not sum them as production', () => {
    const manufacturing = runManufacturingDemo();
    assert.equal(manufacturing.capacityVerified, true);
    assert.equal(manufacturing.outputIssued, true);
    assert.equal(manufacturing.deliveryIssuanceRejected, true);
    assert.equal(manufacturing.notSummedAs2300, true);
    assert.equal(manufacturing.policy.countCapacityAsProduction, false);
    assert.equal(manufacturing.policy.countDeliveryIndependentOfOutput, false);
    assert.equal(manufacturing.policy.claimTypeWeight.CAPACITY, 0n);
    assert.equal(manufacturing.policy.claimTypeWeight.OUTPUT, WEIGHT_SCALE);
  });

  it('rejects a unit mismatch', () => {
    const engine = seededEnergyEngine();
    const claim = fixtureClaim({
      claimId: 'claim.unit',
      objectId: 'obj.solar.alpha',
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 10n,
      unit: 'GPU_HOUR',
    });
    engine.submitClaim(claim);
    const result = engine.verifyClaim(claim.claimId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'UNIT_MISMATCH');
    }
  });

  it('evaluates the issuance formula deterministically without floating point', () => {
    const first = evaluateIssuanceFormula({
      eligibleQuantity: 1_200_000n,
      categoryWeight: WEIGHT_SCALE,
      claimTypeWeight: WEIGHT_SCALE,
      qualityFactor: WEIGHT_SCALE,
      roundingMode: 'FLOOR',
      maximumIssuance: 10_000_000n,
    });
    const second = evaluateIssuanceFormula({
      eligibleQuantity: 1_200_000n,
      categoryWeight: WEIGHT_SCALE,
      claimTypeWeight: WEIGHT_SCALE,
      qualityFactor: WEIGHT_SCALE,
      roundingMode: 'FLOOR',
      maximumIssuance: 10_000_000n,
    });
    assert.equal(first.formulaVersion, FORMULA_VERSION);
    assert.equal(first.moonreyQuantity, second.moonreyQuantity);
    assert.equal(first.moonreyQuantity, 1_200_000n);
    assert.equal(mulDiv(10n, 1n, 3n, 'FLOOR'), 3n);
    assert.equal(mulDiv(10n, 1n, 3n, 'CEIL'), 4n);
    assert.equal(mulDiv(10n, 1n, 4n, 'ROUND_HALF_EVEN'), 2n);
    assert.equal(mulDiv(10n, 1n, 5n, 'ROUND_HALF_EVEN'), 2n);
  });

  it('enforces category and global epoch caps', () => {
    const tight = developmentIssuancePolicy();
    const policy = {
      ...tight,
      maximumIssuancePerCategoryPerEpoch: 100n,
      maximumTotalIssuancePerEpoch: 10_000_000n,
      maximumIssuancePerContribution: 10_000_000n,
    };
    const engine = new ProductiveEconomyEngine(DEV_CLOCK, [policy]);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1n, unit: 'kWh' })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: 'claim.cap',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const category = engine.issueFromClaim(claim.claimId);
    assert.equal(category.ok, false);
    if (!category.ok) {
      assert.equal(category.code, 'EPOCH_CATEGORY_CAP');
    }

    const globalPolicy = {
      ...tight,
      maximumIssuancePerCategoryPerEpoch: 50_000_000n,
      maximumTotalIssuancePerEpoch: 100n,
    };
    const globalEngine = new ProductiveEconomyEngine(DEV_CLOCK, [globalPolicy]);
    globalEngine.registerObject(object);
    globalEngine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1n, unit: 'kWh' })) {
      globalEngine.putOracleFact(fact);
    }
    globalEngine.submitClaim(claim);
    const global = globalEngine.issueFromClaim(claim.claimId);
    assert.equal(global.ok, false);
    if (!global.ok) {
      assert.equal(global.code, 'EPOCH_GLOBAL_CAP');
    }
  });

  it('activates a later governance policy at the configured height', () => {
    const v1 = developmentIssuancePolicy(1);
    const v2 = { ...developmentIssuancePolicy(20), policyVersion: 2, minimumOracleQuorum: 4 };
    const engine = new ProductiveEconomyEngine({ ...DEV_CLOCK, height: 10 }, [v1, v2]);
    assert.equal(engine.activePolicy().policyVersion, 1);
    engine.setClock({ ...DEV_CLOCK, height: 20 });
    assert.equal(engine.activePolicy().policyVersion, 2);
    assert.equal(engine.activePolicy().minimumOracleQuorum, 4);
  });

  it('reconciles MoonRey supply to issuance receipts', () => {
    const energy = runEnergyDemo();
    assert.equal(energy.reconciled, true);
    assert.equal(energy.supply.issued - energy.supply.burned, energy.supply.holdings);
    assert.equal(energy.supply.issued, energy.receipt.moonreyQuantity);
  });

  it('has all four validators agree after graph rebuild', () => {
    const energy = runEnergyDemo();
    assert.equal(energy.validatorsAgree, true);
    assert.equal(energy.graphHash, energy.replicaGraphHash);
    const engine = seededEnergyEngine();
    const snapshot = engine.snapshot();
    engine.dropGraph();
    assert.notEqual(engine.currentGraph().projectionHash, snapshot.graphHash);
    const rebuilt = engine.rebuildGraph();
    assert.equal(rebuilt.projectionHash, snapshot.graphHash);
    assert.equal(engine.snapshot().objects.length, snapshot.objects.length);
    assert.equal(fourValidatorsAgree(engine), true);
  });

  it('does not change blockchain facts when the derived graph is deleted', () => {
    const engine = seededEnergyEngine();
    const claim = fixtureClaim({
      claimId: 'claim.keep',
      objectId: 'obj.solar.alpha',
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n,
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const issued = engine.issueFromClaim(claim.claimId);
    assert.equal(issued.ok, true);
    const before = engine.snapshot();
    engine.dropGraph();
    const afterDrop = engine.snapshot();
    assert.deepEqual(afterDrop.objects, before.objects);
    assert.deepEqual(afterDrop.receipts, before.receipts);
    assert.deepEqual(afterDrop.supply, before.supply);
    engine.rebuildGraph();
    assert.equal(engine.currentGraph().projectionHash, before.graphHash);
  });

  it('labels development weights as engineering simulation parameters', () => {
    const policy = developmentIssuancePolicy();
    assert.equal(policy.parameterClass, POLICY_PARAMETER_CLASS);
    assert.equal(PRODUCTIVE_CATEGORIES.includes('ENERGY'), true);
    assert.equal(PRODUCTIVE_CATEGORIES.includes('AI_COMPUTE'), true);
    assert.equal(defaultUnitRegistry.isAllowed('ENERGY', 'kWh'), true);
    assert.equal(defaultUnitRegistry.normalize('ENERGY', 'kWh', 2n)?.normalizedQuantity, 2_000n);
    assert.equal(defaultUnitRegistry.normalize('ENERGY', 'GPU_HOUR', 1n), null);
  });

  it('keeps arbitrary native MoonRey ISSUE inactive', () => {
    assert.equal(moonreyIssuanceActivated(), false);
  });

  it('exposes productive and moonrey CLI planes', () => {
    const energy = runEnergyDemo();
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    engine.restoreFromSnapshot(
      new ProductiveEconomyEngine(DEV_CLOCK).snapshot(),
    );
    const policy = runProductiveCommand(['moonrey', 'policy']);
    assert.equal(policy.ok, true);
    const graph = runProductiveCommand(['productive', 'graph']);
    assert.equal(graph.ok, true);
    assert.equal(energy.duplicateRejected, true);
  });

  it('runs energy, compute, and manufacturing demos', () => {
    const report = runAllDemos();
    assert.equal(report.energy.duplicateRejected, true);
    assert.equal(report.energy.validatorsAgree, true);
    assert.equal(report.compute.receipt.category, 'AI_COMPUTE');
    assert.ok(report.compute.lineage);
    assert.equal(report.manufacturing.deliveryIssuanceRejected, true);
    const compute = runComputeDemo();
    assert.equal(compute.attribution[0]?.category, 'AI_COMPUTE');
    const factory = automatedFactory();
    const extra = fixtureObject({ objectId: 'obj.extra', category: 'WATER', unitSchema: 'L' });
    assert.equal(factory.category, 'MANUFACTURING');
    assert.equal(extra.category, 'WATER');
    const empty = buildProductiveCapacityGraph({
      objects: [],
      claims: [],
      facts: [],
      contributions: [],
      receipts: [],
    });
    assert.equal(empty.nodes.length, 0);
  });
});
